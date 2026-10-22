# Modelos ONNX para YOLO26n

Coloca aquí el archivo `yolo26n_webgpu.onnx` generado por el script de exportación.

Para exportar y parchear el modelo:
```bash
pip install ultralytics onnx
python scripts/export_and_patch_320.py
```

El script carga `yolo26n.pt`, exporta a ONNX con `imgsz=320` y reemplaza el nodo Softmax del DFL
por `Exp + ReduceSum + Div` para compatibilidad con WebGPU.
