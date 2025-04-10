document.addEventListener("DOMContentLoaded", async function () {
    // Inicializar Drawflow en el contenedor
    const editor = new Drawflow(document.getElementById("drawflow"));
    editor.start();

    // Habilitar arrastrar y soltar nodos
    document.querySelectorAll(".drag-item").forEach(item => {
        item.addEventListener("dragstart", event => {
            event.dataTransfer.setData("node", event.target.dataset.node);
        });
    });

    document.getElementById("drawflow").addEventListener("drop", function (event) {
        event.preventDefault();
        const nodeName = event.dataTransfer.getData("node");
        const x = event.clientX;
        const y = event.clientY;

        if (nodeName) {
            addNode(nodeName, x, y);
        }
    });

    document.getElementById("drawflow").addEventListener("dragover", function (event) {
        event.preventDefault();
    });

    // Función para agregar un nodo al flujo
    function addNode(name, x, y) {
        const data = { info: `Nodo ${name}` };
        editor.addNode(name, 1, 1, x, y, name, data, "");
    }

    // Función para cargar un diagrama guardado
    async function cargarDiagrama() {
        try {
            const response = await fetch('/flujo/data');
            const data = await response.json();
            if (data.flujo) {
                editor.import(data.flujo);
            }
        } catch (error) {
            console.error("Error al cargar el diagrama:", error);
        }
    }

    // Guardar el diagrama
    document.getElementById("guardarFlujo").addEventListener("click", async () => {
        const flujoJSON = JSON.stringify(editor.export());
        try {
            const response = await fetch('/flujo/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flujo: flujoJSON }),
            });

            const data = await response.json();
            alert(data.message);
        } catch (error) {
            console.error("Error al guardar el flujo:", error);
        }
    });

    // Cargar diagrama guardado al iniciar
    cargarDiagrama();
});
