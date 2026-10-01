import os
import sys

def export_and_patch():
    target_onnx = os.path.join("public", "models", "yolov8n_webgpu.onnx")

    try:
        from ultralytics import YOLO
    except ImportError:
        print("[320] Instalando ultralytics...")
        os.system(f"{sys.executable} -m pip install ultralytics")
        from ultralytics import YOLO

    try:
        import onnx
        from onnx import helper
    except ImportError:
        print("[320] Instalando onnx...")
        os.system(f"{sys.executable} -m pip install onnx")
        import onnx
        from onnx import helper

    print("[320] Exportando modelo YOLO26n a ONNX (imgsz=320, opset=13)...")
    model = YOLO("yolo26n.pt")
    exported_path = model.export(format="onnx", imgsz=320, opset=13, dynamic=False)

    print(f"[320] Cargando {exported_path} para parchear No-Softmax...")
    m = onnx.load(exported_path)
    g = m.graph
    new_nodes = []
    patched_count = 0

    for n in g.node:
        if n.op_type == "Softmax" and "dfl" in n.name.lower():
            in_name = n.input[0]
            out_name = n.output[0]

            # 1. Exp
            exp_node = helper.make_node("Exp", [in_name], ["dfl_exp_out"], name="dfl_exp")

            # 2. ReduceSum (axis=1)
            sum_axes = helper.make_tensor("dfl_sum_axes", onnx.TensorProto.INT64, [1], [1])
            g.initializer.append(sum_axes)

            sum_node = helper.make_node(
                "ReduceSum",
                ["dfl_exp_out", "dfl_sum_axes"],
                ["dfl_sum_out"],
                keepdims=1,
                name="dfl_sum"
            )

            # 3. Div
            div_node = helper.make_node(
                "Div",
                ["dfl_exp_out", "dfl_sum_out"],
                [out_name],
                name="dfl_div"
            )

            new_nodes.extend([exp_node, sum_node, div_node])
            patched_count += 1
            print(f"[320] Softmax en {n.name} reemplazado por Exp + ReduceSum + Div")
        else:
            new_nodes.append(n)

    del g.node[:]
    g.node.extend(new_nodes)
    onnx.checker.check_model(m)

    os.makedirs(os.path.dirname(target_onnx), exist_ok=True)
    onnx.save(m, target_onnx)
    print(f"[320] ✅ Modelo 320x320 Parchado listo en: {target_onnx}")

    # Eliminar opt_check.onnx si existe
    opt_check = os.path.join("public", "models", "opt_check.onnx")
    if os.path.exists(opt_check):
        os.remove(opt_check)
        print("[320] Archivo temporal opt_check.onnx eliminado.")

if __name__ == "__main__":
    export_and_patch()
