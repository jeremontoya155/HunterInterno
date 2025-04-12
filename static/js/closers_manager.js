// =============================================
// static/js/closers_manager.js
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Closers Manager JS Cargado.");

    // --- Referencias DOM ---
    const formContainer = document.getElementById('form-container');
    const closerForm = document.getElementById('closer-form');
    const formTitle = document.getElementById('form-title');
    const closerIdInput = document.getElementById('closer_id'); // Input oculto ID
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const tableBody = document.querySelector('.table-section table tbody'); // Cuerpo de la tabla

    // Verificar si el formulario existe (para roles sin permiso de edición)
    if (!formContainer || !closerForm || !cancelEditBtn) {
        console.log("Formulario de edición/agregado no disponible para este rol.");
        // Si no hay form, no necesitamos el resto de la lógica de edición/borrado
        return;
    }

    // --- Funciones ---

    // Resetea el formulario al modo "Agregar"
    const resetForm = () => {
        if (closerForm) closerForm.reset();
        if (closerIdInput) closerIdInput.value = '';
        if (formTitle) formTitle.innerHTML = '<i class="fas fa-user-plus"></i> Agregar Nuevo Closer';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        // Opcional: Mover el foco al primer input
        const firstInput = closerForm?.querySelector('input[name="nombre"]');
        if (firstInput) firstInput.focus();
    };

    // Llenar el formulario para editar
    const populateFormForEdit = (closerData) => {
        if (!closerData || !closerForm) return;
        console.log("Poblando formulario para editar:", closerData);

        closerIdInput.value = closerData.id;
        document.getElementById('nombre').value = closerData.nombre || '';
        document.getElementById('estado').value = closerData.estado || 'activo';
        document.getElementById('cuentas_asignadas').value = (closerData.cuentas_asignadas || []).join(', ');
        document.getElementById('agendas').value = closerData.agendas || 0;
        // Añadir aquí si tienes otros campos en el form (notas, etc.)
        // document.getElementById('notas_auditoria').value = closerData.notas_auditoria || '';

        formTitle.innerHTML = `<i class="fas fa-edit"></i> Editar Closer: ${closerData.nombre}`;
        cancelEditBtn.style.display = 'inline-flex'; // Mostrar botón Cancelar
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Manejar click en botones de la tabla (Editar/Borrar)
    const handleTableClick = async (event) => {
        const target = event.target;
        const editButton = target.closest('.edit-btn');
        const deleteButton = target.closest('.delete-btn');

        if (editButton) {
            event.preventDefault();
            const closerId = editButton.dataset.id;
            const row = document.getElementById(`closer-row-${closerId}`);
            if (row?.dataset?.closer) {
                try {
                    const closerData = JSON.parse(row.dataset.closer);
                    populateFormForEdit(closerData);
                } catch (e) { console.error("Error parseando datos para editar:", e); alert("Error al cargar datos."); }
            }
        } else if (deleteButton) {
            event.preventDefault();
            const closerId = deleteButton.dataset.id;
            const closerName = deleteButton.closest('tr')?.querySelector('td:first-child')?.textContent || `ID ${closerId}`;

            if (confirm(`¿Estás seguro de que quieres eliminar al closer "${closerName}"? Esta acción no se puede deshacer.`)) {
                 await deleteCloser(closerId, deleteButton);
            }
        }
    };

    // Función para eliminar un closer (AJAX)
    async function deleteCloser(id, buttonElement) {
        console.log(`Intentando eliminar closer ID: ${id}`);
        if (buttonElement) buttonElement.disabled = true; // Deshabilitar botón

        try {
            const response = await fetch(`/closers/${id}`, {
                method: 'DELETE',
                headers: {
                    // Incluir headers necesarios, como CSRF token si lo usas
                     'Accept': 'application/json'
                }
            });

            // Borrar siempre aunque falle, para simplificar UX? O manejar error...
            const row = document.getElementById(`closer-row-${id}`);
            if (row) row.remove();

             // Parsear respuesta JSON sólo si no es 204 No Content
             let result = { success: response.ok, message: response.statusText };
             if (response.status !== 204 && response.headers.get("content-type")?.includes("application/json")) {
                  result = await response.json();
             }

            if (!response.ok) {
                throw new Error(result.message || `Error ${response.status}`);
            }

            console.log(`Closer ${id} eliminado.`);
            // Mostrar mensaje flash (idealmente el backend lo haría con redirect,
            // pero si usamos AJAX puro, lo hacemos aquí)
             showFlashMessage('Closer eliminado correctamente.', 'success');
             resetForm(); // Resetear form si se estaba editando el borrado

        } catch (error) {
            console.error('Error al eliminar closer:', error);
            alert(`Error al eliminar: ${error.message}`);
             if (buttonElement) buttonElement.disabled = false; // Rehabilitar si falló
        }
    }

    // Función para mostrar mensajes temporales (simulando flash)
    function showFlashMessage(message, type = 'info') {
        const container = document.querySelector('.main-container'); // Dónde mostrar
        if (!container) return;
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.marginTop = '1rem'; // Espacio
        container.insertBefore(alertDiv, container.firstChild); // Poner al principio
        setTimeout(() => {
             alertDiv.style.transition = 'opacity 0.5s ease';
             alertDiv.style.opacity = '0';
             setTimeout(() => alertDiv.remove(), 500); // Eliminar del DOM
        }, 3000); // Desaparece después de 3 segundos
    }


    // --- Event Listeners ---
    if (tableBody) {
        tableBody.addEventListener('click', handleTableClick);
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', (event) => {
            event.preventDefault();
            resetForm();
        });
    }

     // Opcional: Limpiar formulario al enviar (si la página no se recarga)
     if (closerForm) {
         closerForm.addEventListener('submit', () => {
             // Si el envío es exitoso y no hay recarga, llama a resetForm() después
             // Esto es más complejo si usas AJAX para el submit del form.
             // Por ahora, el form normal hace un POST y recarga, así que no es necesario.
         });
     }

    console.log("Closers Manager inicializado.");

}); // Fin DOMContentLoaded