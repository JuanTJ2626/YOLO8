# Modelos ONNX para YOLO
Coloca aquí tu archivo `yolo26n.onnx` o `yolov8n.onnx`.

Para exportar el modelo usando Python:
```bash
pip install ultralytics
yolo export model=yolo26n.pt format=onnx imgsz=640
```
Y luego copia `yolo26n.onnx` en `public/models/yolo26n.onnx`.
