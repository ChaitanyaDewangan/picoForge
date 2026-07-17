import * as THREE from "three";
import { PathTracingRenderer, PathTracingSceneGenerator } from "three-gpu-pathtracer";
import type { GpuTier } from "./ViewportEngine.ts";

export async function probeGpuTierAsync(): Promise<GpuTier> {
  const saved = localStorage.getItem("picoforge.gpu.tier");
  if (saved === "A" || saved === "B" || saved === "C") return saved as GpuTier;

  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 800;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0, 5);

      const geom = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      
      const light = new THREE.DirectionalLight(0xffffff, 1);
      scene.add(light);

      // Raster test: 60 frames
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) {
        mesh.rotation.x += 0.1;
        renderer.render(scene, camera);
      }
      const rasterTime = performance.now() - t0;
      
      // PT test: 40 samples
      let ptTime = 0;
      let pathTracer: any = null;
      try {
        pathTracer = new PathTracingRenderer(renderer);
        const generator = new PathTracingSceneGenerator();
        const { bvh, textures, materials } = generator.generate(scene);
        
        const ptGeom = bvh.geometry;
        const ptMat = pathTracer.material;
        ptMat.bvh.updateFrom(bvh);
        ptMat.attributesArray.updateFrom(
          ptGeom.attributes.normal,
          ptGeom.attributes.tangent,
          ptGeom.attributes.uv,
          ptGeom.attributes.color
        );
        ptMat.materialIndexAttribute.updateFrom(ptGeom.attributes.materialIndex);
        ptMat.materials.updateFrom(materials, textures);
        
        pathTracer.setScene(scene, camera);
        
        const t1 = performance.now();
        for (let i = 0; i < 40; i++) {
          pathTracer.renderSample();
        }
        ptTime = performance.now() - t1;
      } catch (e) {
        // PT unsupported
        ptTime = 999999;
      }

      if (pathTracer) pathTracer.dispose();
      renderer.dispose();
      geom.dispose();
      mat.dispose();

      // Classify
      // A tier: raster < 300ms, PT < 1000ms
      // B tier: PT works but slower
      // C tier: PT failed or extremely slow
      let tier: GpuTier = "C";
      if (ptTime < 999999) {
        if (rasterTime < 500 && ptTime < 1500) {
          tier = "A";
        } else if (ptTime < 5000) {
          tier = "B";
        }
      }

      localStorage.setItem("picoforge.gpu.tier", tier);
      resolve(tier);
    } catch (err) {
      // Fallback
      localStorage.setItem("picoforge.gpu.tier", "C");
      resolve("C");
    }
  });
}
