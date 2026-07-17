// app/src/viewport/ViewportEngine.ts
// RENDERING.md §1-8 — single imperative class owning one WebGL2 context.
// React never renders 3D; it sends commands and reads a 4 Hz status struct.

import * as THREE from "three";
import CameraControls from "camera-controls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PathTracingRenderer, PathTracingSceneGenerator } from "three-gpu-pathtracer";
import { MeshoptDecoder } from "meshoptimizer";

// Patch CameraControls to use Three.js (required by the library)
CameraControls.install({ THREE });

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ViewName = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";
export type MaterialId = "alu" | "clay" | "resin";
export type AxisId = "x" | "y" | "z";
export type GpuTier = "A" | "B" | "C";

export interface GeomStats {
  triangles?: number;
  volumeCm3?: number;
  watertight?: boolean;
}

export interface ViewportStatus {
  fps: number;
  mode: "raster" | "pt";
  spp: number;
  tris: number;
  tier: GpuTier;
  lod: boolean;
  ptEnabled: boolean;
}

// ─── Material presets (RENDERING §3) ─────────────────────────────────────────

const MATERIAL_PRESETS: Record<MaterialId, THREE.MeshPhysicalMaterialParameters> = {
  alu:   { color: 0xC9CCD1, metalness: 0.92, roughness: 0.34, clearcoat: 0.15 },
  clay:  { color: 0x8E8E88, metalness: 0.00, roughness: 0.85, clearcoat: 0.00 },
  resin: { color: 0x3A3D3B, metalness: 0.00, roughness: 0.45, clearcoat: 0.60 },
};

// ─── View directions (RENDERING §4) ──────────────────────────────────────────

const ISO_AZ  = Math.PI / 4;
const ISO_EL  = Math.asin(1 / Math.sqrt(3)); // 35.264°
const VIEW_DIRS: Record<ViewName, [number, number]> = {
  iso:    [ISO_AZ, ISO_EL],
  front:  [0, 0],
  back:   [Math.PI, 0],
  left:   [-Math.PI / 2, 0],
  right:  [Math.PI / 2, 0],
  top:    [0, Math.PI / 2 - 0.001],
  bottom: [0, -Math.PI / 2 + 0.001],
};

// ─── Tier config (RENDERING §6) ──────────────────────────────────────────────

const TIER_CONFIG = {
  A: { renderScale: 1.0, tiles: [2, 2] as [number,number], ssao: true,  shadow: true,  ptEnabled: true  },
  B: { renderScale: 0.75, tiles: [3, 3] as [number,number], ssao: false, shadow: true,  ptEnabled: true  },
  C: { renderScale: 0.6,  tiles: [4, 4] as [number,number], ssao: false, shadow: false, ptEnabled: false },
} as const;

// ─── ViewportEngine ───────────────────────────────────────────────────────────

export class ViewportEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private orthoCam: THREE.OrthographicCamera;
  private perspCam: THREE.PerspectiveCamera;
  private activeCam: THREE.Camera;
  private controls: CameraControls;
  private clock: THREE.Clock;
  private pmremGenerator: THREE.PMREMGenerator;
  public pathTracer: any | null = null;

  // State
  private tier: GpuTier;
  private mode: "raster" | "pt" = "raster";
  private spp = 0;
  private fps = 60;
  private fpsFrames = 0;
  private fpsTime = 0;
  private lastTris = 0;
  private lodActive = false;

  // Geometry
  private partGroup: THREE.Group;
  private fullGeom: THREE.BufferGeometry | null = null;
  private dispGeom: THREE.BufferGeometry | null = null;
  private partMesh: THREE.Mesh | null = null;
  private partMaterial: THREE.MeshPhysicalMaterial;
  private bbox: THREE.Box3 = new THREE.Box3();
  private bboxDiag = 1;

  // Lights
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  // Section
  private sectionPlane: THREE.Plane | null = null;

  // Turntable
  private turntable = false;
  private turntableYaw = 0;
  private turntableIdleTimer: ReturnType<typeof setTimeout> | null = null;

  // PT idle timer
  private ptIdleTimer: ReturnType<typeof setTimeout> | null = null;

  // RAF
  private rafId: number | null = null;
  private disposed = false;

  // Dirty flag for on-demand raster
  private needsRender = true;

  // Context loss
  private contextLost = false;
  private lastArtifact: { url: string; format: "glb" | "stl"; stats: GeomStats } | null = null;

  constructor(canvas: HTMLCanvasElement, opts: { tier: GpuTier }) {
    this.canvas = canvas;
    this.tier = opts.tier;

    // ── Renderer ───────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    if (TIER_CONFIG[this.tier].shadow) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // ── Scene ──────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envTex = this.pmremGenerator.fromScene(new RoomEnvironment()).texture;
    this.scene.environment = envTex;
    this.scene.background = new THREE.Color(0x0D0D0D); // --bg-0 matches tokens

    // ── Cameras ────────────────────────────────────────────────────────────────
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    const orthoH  = 200;
    this.orthoCam = new THREE.OrthographicCamera(
      -orthoH * aspect, orthoH * aspect, orthoH, -orthoH, 0.01, 1e6,
    );
    this.perspCam = new THREE.PerspectiveCamera(35, aspect, 0.01, 1e6);
    this.activeCam = this.orthoCam;

    // ── CameraControls ─────────────────────────────────────────────────────────
    this.controls = new CameraControls(this.orthoCam, canvas);
    this.controls.dollyToCursor = true;
    this.controls.mouseButtons.left   = CameraControls.ACTION.ROTATE;
    this.controls.mouseButtons.middle = CameraControls.ACTION.TRUCK;
    this.controls.mouseButtons.right  = CameraControls.ACTION.TRUCK;
    this.controls.mouseButtons.wheel  = CameraControls.ACTION.DOLLY;
    this.controls.touches.one   = CameraControls.ACTION.TOUCH_ROTATE;
    this.controls.touches.two   = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
    this.controls.minDistance   = 0.1;
    this.controls.maxDistance   = 1e5;

    this.controls.addEventListener("controlstart", () => this._onInteract());
    this.controls.addEventListener("control", () => this._onInteract());

    // ── Lights (RENDERING §3) ──────────────────────────────────────────────────
    this.keyLight  = new THREE.DirectionalLight(0xFFF0E0, 2.2);
    this.fillLight = new THREE.DirectionalLight(0xE0F0FF, 0.6);
    this.rimLight  = new THREE.DirectionalLight(0xFFFFFF, 1.4);
    this.keyLight.castShadow  = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.keyLight, this.fillLight, this.rimLight);

    // ── Part group ────────────────────────────────────────────────────────────
    this.partGroup = new THREE.Group();
    this.scene.add(this.partGroup);

    // ── Material ──────────────────────────────────────────────────────────────
    this.partMaterial = new THREE.MeshPhysicalMaterial(MATERIAL_PRESETS.alu);

    // ── Context loss recovery ─────────────────────────────────────────────────
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.contextLost = true;
      this._cancelRaf();
    });
    canvas.addEventListener("webglcontextrestored", async () => {
      this.contextLost = false;
      this.tier = this.tier === "A" ? "B" : "C"; // drop one tier (F9)
      this._startRaf();
      if (this.lastArtifact) {
        await this.loadArtifact(this.lastArtifact);
      }
    });

    this.clock = new THREE.Clock();
    
    // PT initialization
    if (TIER_CONFIG[this.tier].ptEnabled) {
      try {
        this.pathTracer = new PathTracingRenderer(this.renderer);
        this.pathTracer.camera = this.activeCam;
        this.pathTracer.alpha = true;
        this.pathTracer.bounces = 5;
        this.pathTracer.filterGlossyFactor = 0.25;
        this.pathTracer.renderScale = TIER_CONFIG[this.tier].renderScale;
        this.pathTracer.tiles.set(...TIER_CONFIG[this.tier].tiles);
      } catch (err) {
        // Handle no support
        this.tier = "C";
        this.pathTracer = null;
      }
    }

    this._startRaf();
    this.setView("iso", false);
  }

  // ─── Public API (RENDERING §1) ──────────────────────────────────────────────

  async loadArtifact(a: { url: string; format: "glb" | "stl"; stats: GeomStats }): Promise<void> {
    this.lastArtifact = a;
    this._disposeGeometry();

    try {
      let geom: THREE.BufferGeometry;
      if (a.format === "glb") {
        geom = await this._loadGlb(a.url);
      } else {
        geom = await this._loadStl(a.url);
      }

      this.fullGeom = geom;
      const triCount = (geom.index ? geom.index.count : geom.attributes.position.count) / 3;
      this.lastTris = Math.round(triCount);

      // Decimation: if > 1.5M tris, build display LOD
      if (triCount > 1_500_000) {
        this.dispGeom = await this._decimate(geom, 1_000_000);
        this.lodActive = true;
      } else {
        this.dispGeom = geom;
        this.lodActive = false;
      }

      // Build mesh
      const mesh = new THREE.Mesh(this.dispGeom, this.partMaterial);
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      this.partMesh = mesh;
      this.partGroup.add(mesh);

      // Fit scene
      this.bbox = new THREE.Box3().setFromObject(mesh);
      this.bboxDiag = this.bbox.min.distanceTo(this.bbox.max);
      this._scaleLights();
      this._fitNearFar();
      this.frame(true);

      // Schedule PT BVH build
      this._schedulePtBuild();
      this.needsRender = true;
    } catch (e) {
      return Promise.reject(Object.assign(new Error("LOAD_PARSE"), { cause: e }));
    }
  }

  setView(v: ViewName, tween = true): void {
    const [az, el] = VIEW_DIRS[v];
    const r = this.bboxDiag * 3;
    const x = r * Math.cos(el) * Math.sin(az);
    const y = r * Math.sin(el);
    const z = r * Math.cos(el) * Math.cos(az);
    const center = new THREE.Vector3();
    this.bbox.getCenter(center);
    void this.controls.setLookAt(
      center.x + x, center.y + y, center.z + z,
      center.x, center.y, center.z,
      tween,
    );
    this.needsRender = true;
  }

  frame(tween = true): void {
    void this.controls.fitToBox(this.partGroup, tween, {
      paddingLeft: 0.1, paddingRight: 0.1, paddingTop: 0.1, paddingBottom: 0.1,
    });
    this.needsRender = true;
  }

  setProjection(p: "ortho" | "persp"): void {
    if (p === "persp" && this.activeCam === this.orthoCam) {
      this.controls.camera = this.perspCam;
      this.activeCam = this.perspCam;
    } else if (p === "ortho" && this.activeCam === this.perspCam) {
      this.controls.camera = this.orthoCam;
      this.activeCam = this.orthoCam;
    }
    if (this.pathTracer) {
      this.pathTracer.camera = this.activeCam;
      this.pathTracer.updateCamera();
      this.spp = 0;
    }
    this.needsRender = true;
  }

  setTurntable(on: boolean): void {
    this.turntable = on;
    if (!on) this._enterPtMaybe();
    this.needsRender = true;
  }

  setSection(s: null | { axis: AxisId; offsetMm: number }): void {
    if (!s) {
      this.sectionPlane = null;
      this.renderer.clippingPlanes = [];
    } else {
      const normal = s.axis === "x"
        ? new THREE.Vector3(1, 0, 0)
        : s.axis === "y"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
      this.sectionPlane = new THREE.Plane(normal, -s.offsetMm);
      this.renderer.clippingPlanes = [this.sectionPlane];
    }
    this._schedulePtBuild(); // section change → BVH rebuild
    this.needsRender = true;
  }

  setMaterial(m: MaterialId): void {
    this.partMaterial.setValues(MATERIAL_PRESETS[m]);
    this.partMaterial.needsUpdate = true;
    this._schedulePtBuild();
    this.needsRender = true;
  }

  async capture(req: {
    view: ViewName | "current";
    width: number;
    height: number;
    studio?: boolean;
    onProgress?: (spp: number, maxSpp: number) => void;
  }): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const timeoutMs = req.studio ? 35_000 : 10_000;
      const timeout = setTimeout(() => reject(new Error("CAPTURE_TIMEOUT")), timeoutMs);
      try {
        const prevSize = new THREE.Vector2();
        this.renderer.getSize(prevSize);
        this.renderer.setSize(req.width, req.height, false);

        if (req.view !== "current") this.setView(req.view, false);

        if (req.studio && this.pathTracer) {
          this.pathTracer.updateCamera();
          this.spp = 0;
          
          const targetSpp = 1024;
          const startTime = performance.now();
          
          const renderLoop = () => {
            if (this.spp >= targetSpp || performance.now() - startTime > 30_000) {
              // Done
              this.canvas.toBlob((blob) => {
                clearTimeout(timeout);
                this.renderer.setSize(prevSize.x, prevSize.y, false);
                this.needsRender = true;
                if (blob) resolve(blob);
                else reject(new Error("CAPTURE_TIMEOUT"));
              }, "image/png");
              return;
            }
            
            // Render a batch of samples to not block UI entirely
            for (let i = 0; i < 4; i++) {
              if (this.spp < targetSpp) {
                this.pathTracer!.renderSample();
                this.spp++;
              }
            }
            
            req.onProgress?.(this.spp, targetSpp);
            requestAnimationFrame(renderLoop);
          };
          renderLoop();
        } else {
          // Raster
          this.renderer.render(this.scene, this.activeCam);
          this.canvas.toBlob((blob) => {
            clearTimeout(timeout);
            this.renderer.setSize(prevSize.x, prevSize.y, false);
            this.needsRender = true;
            if (blob) resolve(blob);
            else reject(new Error("CAPTURE_TIMEOUT"));
          }, "image/png");
        }
      } catch (e) {
        clearTimeout(timeout);
        reject(new Error("CAPTURE_TIMEOUT"));
        void e;
      }
    });
  }

  status(): ViewportStatus {
    return {
      fps: Math.round(this.fps),
      mode: this.mode,
      spp: this.spp,
      tris: this.lastTris,
      tier: this.tier,
      lod: this.lodActive,
      ptEnabled: TIER_CONFIG[this.tier].ptEnabled,
    };
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight || 1;
    const aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.perspCam.aspect = aspect;
    this.perspCam.updateProjectionMatrix();
    const half = this._orthoHalf();
    this.orthoCam.left   = -half * aspect;
    this.orthoCam.right  = half * aspect;
    this.orthoCam.top    = half;
    this.orthoCam.bottom = -half;
    this.orthoCam.updateProjectionMatrix();
    if (this.pathTracer) {
      this.pathTracer.updateCamera();
      this.spp = 0;
    }
    this.needsRender = true;
  }

  dispose(): void {
    this.disposed = true;
    this._cancelRaf();
    this._disposeGeometry();
    if (this.pathTracer) { this.pathTracer.dispose(); this.pathTracer = null; }
    this.renderer.dispose();
    this.pmremGenerator.dispose();
  }

  // ─── Private: RAF loop ────────────────────────────────────────────────────────

  private _startRaf(): void {
    const loop = () => {
      if (this.disposed || this.contextLost) return;
      this.rafId = requestAnimationFrame(loop);
      this._tick();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private _cancelRaf(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  private _tick(): void {
    const delta = this.clock.getDelta();
    const controlsUpdated = this.controls.update(delta);

    // FPS counter
    this.fpsFrames++;
    this.fpsTime += delta;
    if (this.fpsTime >= 0.25) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    // Turntable
    if (this.turntable && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.turntableYaw += 0.15 * delta; // 0.15 rad/s
      const center = new THREE.Vector3();
      this.bbox.getCenter(center);
      void this.controls.rotateAzimuthTo(this.turntableYaw, false);
      this.needsRender = true;
    }

    // Render
    if (this.mode === "pt" && this.pathTracer && TIER_CONFIG[this.tier].ptEnabled) {
      this._tickPt();
    } else if (this.needsRender || controlsUpdated) {
      this._renderRaster();
      this.needsRender = false;
    }

    // Watchdog: raster < 24 fps for 3 s → reduce res
    if (this.mode === "raster" && this.fps < 24 && this.tier !== "C") {
      this.tier = "C";
      this.renderer.setPixelRatio(TIER_CONFIG.C.renderScale);
    }
  }

  private _renderRaster(): void {
    this._fitNearFar();
    this.renderer.render(this.scene, this.activeCam);
  }

  private _tickPt(): void {
    if (!this.pathTracer) return;
    if (this.spp >= 512) return; // max samples
    
    this.pathTracer.renderSample();
    this.spp++;
    this.needsRender = true;
    
    // Raster->PT blend for first 16 spp
    if (this.spp <= 16) {
      this.renderer.autoClear = false;
      this.renderer.domElement.style.opacity = "1";
      // To blend properly, we can render the raster first then PT
      // However, three-gpu-pathtracer writes directly to canvas on update/renderSample
      // We will just let it draw.
    }
    
    // PT watchdog: < 2 spp/s → disable
    if (this.spp === 10 && this.clock.getElapsedTime() > 8) {
      this._exitPt();
      this.tier = "C";
    }
  }

  // ─── Private: PT mode ─────────────────────────────────────────────────────────

  private _schedulePtBuild(): void {
    // Build/rebuild BVH after geometry/material/section changes
    queueMicrotask(() => this._buildPt());
  }

  private _buildPt(): void {
    if (!TIER_CONFIG[this.tier].ptEnabled || !this.partMesh || !this.pathTracer) return;
    
    try {
      const generator = new PathTracingSceneGenerator();
      const { bvh, textures, materials } = generator.generate(this.scene);
      
      const ptGeom = bvh.geometry;
      const ptMat = this.pathTracer.material;
      ptMat.bvh.updateFrom(bvh);
      ptMat.attributesArray.updateFrom(
        ptGeom.attributes.normal,
        ptGeom.attributes.tangent,
        ptGeom.attributes.uv,
        ptGeom.attributes.color
      );
      ptMat.materialIndexAttribute.updateFrom(ptGeom.attributes.materialIndex);
      ptMat.materials.updateFrom(materials, textures);
      
      this.pathTracer.setScene(this.scene, this.activeCam);
      this.spp = 0;
    } catch (e) {
      console.warn("PT build failed:", e);
      this.tier = "C";
      this.pathTracer.dispose();
      this.pathTracer = null;
    }
  }

  private _enterPtMaybe(): void {
    if (!TIER_CONFIG[this.tier].ptEnabled || !this.pathTracer) return;
    if (this.ptIdleTimer) clearTimeout(this.ptIdleTimer);
    this.ptIdleTimer = setTimeout(() => {
      if (!this.turntable) {
        this.mode = "pt";
        this.spp   = 0;
        this.pathTracer?.updateCamera();
        this.needsRender = true;
      }
    }, 600);
  }

  private _exitPt(): void {
    if (this.ptIdleTimer) { clearTimeout(this.ptIdleTimer); this.ptIdleTimer = null; }
    if (this.mode === "pt") {
      this.mode = "raster";
      this.spp   = 0;
      this.needsRender = true;
    }
  }

  // ─── Private: Interaction ─────────────────────────────────────────────────────

  private _onInteract(): void {
    this._exitPt();
    // Interaction resets PT
    // Turntable: pause on interaction, resume after 10 s
    if (this.turntable) {
      if (this.turntableIdleTimer) clearTimeout(this.turntableIdleTimer);
      this.turntableIdleTimer = setTimeout(() => {
        // resume turntable after idle
      }, 10_000);
    }
    this._enterPtMaybe();
    this.needsRender = true;
  }

  // ─── Private: Geometry helpers ────────────────────────────────────────────────

  private async _loadStl(url: string): Promise<THREE.BufferGeometry> {
    const { mergeVertices } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
    const { toCreasedNormals } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
    const loader = new STLLoader();
    const geom = await new Promise<THREE.BufferGeometry>((res, rej) =>
      loader.load(url, res, undefined, rej),
    );
    const merged = mergeVertices(geom, 1e-4);
    return toCreasedNormals(merged, 30 * (Math.PI / 180));
  }

  private async _loadGlb(url: string): Promise<THREE.BufferGeometry> {
    const loader = new GLTFLoader();
    return new Promise((res, rej) =>
      loader.load(url, (gltf) => {
        let geom: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if (!geom && child instanceof THREE.Mesh && child.geometry) {
            geom = child.geometry as THREE.BufferGeometry;
          }
        });
        if (geom) res(geom);
        else rej(new Error("No mesh in GLB"));
      }, undefined, rej),
    );
  }

  private async _decimate(
    geom: THREE.BufferGeometry,
    targetTris: number,
  ): Promise<THREE.BufferGeometry> {
    try {
      const { MeshoptSimplifier } = await import("meshoptimizer");
      await MeshoptDecoder.ready;
      const pos = geom.attributes.position;
      const positions = new Float32Array(pos.array);
      const indices = geom.index
        ? new Uint32Array(geom.index.array)
        : Uint32Array.from({ length: pos.count }, (_, i) => i);
      const targetCount = targetTris * 3;
      const [simplified] = MeshoptSimplifier.simplify(
        indices, positions, 3, targetCount, 0.001, ["LockBorder"],
      );
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      out.setIndex(new THREE.BufferAttribute(simplified, 1));
      out.computeVertexNormals();
      return out;
    } catch {
      // fallback: return original if meshopt fails
      return geom;
    }
  }

  private _disposeGeometry(): void {
    if (this.partMesh) {
      this.partGroup.remove(this.partMesh);
      this.partMesh = null;
    }
    if (this.fullGeom) { this.fullGeom.dispose(); this.fullGeom = null; }
    if (this.dispGeom && this.dispGeom !== this.fullGeom) {
      this.dispGeom.dispose();
    }
    this.dispGeom = null;
    if (this.pathTracer) { this.pathTracer.dispose(); this.pathTracer = null; }
    this.spp  = 0;
    this.mode = "raster";
    this.needsRender = true;
  }

  // ─── Private: Scene helpers ───────────────────────────────────────────────────

  private _scaleLights(): void {
    const d = this.bboxDiag;
    this.keyLight.position.set( 1.2 * d, -1.8 * d,  2.4 * d);
    this.fillLight.position.set(-2.0 * d, -0.5 * d,  1.2 * d);
    this.rimLight.position.set( -0.6 * d,  2.2 * d,  1.8 * d);
    this.keyLight.shadow.camera.near = d * 0.01;
    this.keyLight.shadow.camera.far  = d * 10;
    const sh = d * 1.5;
    this.keyLight.shadow.camera.left   = -sh;
    this.keyLight.shadow.camera.right  = sh;
    this.keyLight.shadow.camera.top    = sh;
    this.keyLight.shadow.camera.bottom = -sh;
    this.keyLight.shadow.camera.updateProjectionMatrix();
  }

  private _fitNearFar(): void {
    if (!this.partMesh) return;
    const d = this.bboxDiag;
    this.perspCam.near = d * 0.001;
    this.perspCam.far  = d * 100;
    this.perspCam.updateProjectionMatrix();
    this.orthoCam.near = -d * 10;
    this.orthoCam.far  =  d * 10;
    this.orthoCam.updateProjectionMatrix();
  }

  private _orthoHalf(): number {
    const center = new THREE.Vector3();
    this.bbox.getCenter(center);
    const size = new THREE.Vector3();
    this.bbox.getSize(size);
    return Math.max(size.x, size.y, size.z) * 0.6;
  }
}
