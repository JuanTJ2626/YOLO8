import os
import sys
import shutil

def export_yolo_to_onnx(model_name="yolo11n.pt", target_path="public/models/yolo26n.onnx"):
    """
    Descarga y exporta un modelo oficial YOLO a ONNX (640x640)
    y lo guarda directamente en public/models/yolo26n.onnx
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[YOLO EXPORT] Ultralytics no está instalado. Instalando ultralytics...")
        os.system(f"{sys.executable} -m pip install ultralytics")
        # pyrefly: ignore [missing-import]
        from ultralytics import YOLO

    print(f"[YOLO EXPORT] Cargando modelo {model_name}...")
    model = YOLO(model_name)
    
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    print("[YOLO EXPORT] Exportando a formato ONNX (imgsz=640)...")
    exported_file = model.export(format="onnx", imgsz=640, dynamic=False)
    
    print(f"[YOLO EXPORT] Copiando {exported_file} -> {target_path}")
    shutil.copy(exported_file, target_path)
    print(f"[YOLO EXPORT] ¡Modelo ONNX real listo en {target_path}!")

if __name__ == "__main__":
    export_yolo_to_onnx()
