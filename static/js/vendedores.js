document.addEventListener('DOMContentLoaded', () => {
    const formContainer = document.getElementById('form-container');
    const vendedorForm = document.getElementById('vendedor-form');
    const formTitle = document.getElementById('form-title');
    const vendedorIdInput = document.getElementById('vendedor_id');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // Verifica si el formulario existe (solo para admin/auditoria)
    if (!formContainer || !vendedorForm) {
        // console.log("Formulario no presente para este rol.");
        return;
    }

    const tableBody = document.querySelector('.table-section table tbody');

    // Función para resetear el formulario a modo "Agregar"
    const resetForm = () => {
        vendedorForm.reset(); // Limpia campos
        vendedorIdInput.value = ''; // Borra ID oculto
        formTitle.innerHTML = '<i class="fas fa-user-plus"></i> Agregar Nuevo Vendedor'; // Título original
        cancelEditBtn.style.display = 'none'; // Oculta botón cancelar
        formContainer.scrollIntoView({ behavior: 'smooth' }); // Lleva al formulario
    };

    // Añadir listener a la tabla (delegación de eventos)
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const target = event.target;
            // Busca el botón de editar más cercano al elemento clickeado
            const editButton = target.closest('.edit-btn');

            if (editButton) {
                event.preventDefault(); // Prevenir cualquier acción por defecto
                const vendedorId = editButton.dataset.id;
                const row = document.getElementById(`vendedor-row-${vendedorId}`);
                if (row && row.dataset.vendedor) {
                    try {
                        const vendedorData = JSON.parse(row.dataset.vendedor);

                        // Llenar el formulario con los datos del vendedor
                        vendedorIdInput.value = vendedorData.id;
                        document.getElementById('nombre').value = vendedorData.nombre || '';
                        document.getElementById('manager_asignado').value = vendedorData.manager_asignado || '';
                        // Convertir array de cuentas a string separado por comas
                        document.getElementById('cuentas_asignadas').value = (vendedorData.cuentas_asignadas || []).join(', ');
                        document.getElementById('porcentaje_cumplimiento').value = vendedorData.porcentaje_cumplimiento || 0;
                        document.getElementById('objetivo_mensual').value = vendedorData.objetivo_mensual || 0;
                        // Formatear fecha para input type="date" (YYYY-MM-DD)
                        document.getElementById('fecha_ingreso').value = vendedorData.fecha_ingreso ? vendedorData.fecha_ingreso.split('T')[0] : '';
                        document.getElementById('estado').value = vendedorData.estado || 'activo';
                        document.getElementById('notas_auditoria').value = vendedorData.notas_auditoria || '';

                        // Cambiar título y mostrar botón cancelar
                        formTitle.innerHTML = `<i class="fas fa-edit"></i> Editar Vendedor: ${vendedorData.nombre}`;
                        cancelEditBtn.style.display = 'inline-flex';

                        // Scroll suave hacia el formulario
                        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    } catch (e) {
                        console.error("Error al parsear datos del vendedor:", e);
                        alert("Error al cargar los datos para editar.");
                    }
                }
            }
        });
    }

    // Listener para el botón "Cancelar Edición"
    cancelEditBtn.addEventListener('click', (event) => {
         event.preventDefault();
         resetForm();
    });
});