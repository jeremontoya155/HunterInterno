// =============================================
// static/js/auditoria_trackeo_manager.js
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Auditoría Trackeo Manager JS Cargado.");

    // --- Referencias DOM ---
    const manualModalOverlay = document.getElementById('manualNicheModalOverlay');
    const manualNicheForm = document.getElementById('manual-niche-form');
    const bulkManualAddModalOverlay = document.getElementById('bulkManualAddModalOverlay');
    const bulkManualAddForm = document.getElementById('bulk-manual-add-form');
    const bulkTextarea = document.getElementById('bulk-textarea');
    const bulkFeedback = document.getElementById('bulk-add-feedback');
    const bulkErrorsList = document.getElementById('bulk-errors-list');

    const manualSearchInput = document.getElementById('manual-search');
    const manualTableBody = document.getElementById('manual-niche-table')?.querySelector('tbody');
    const manualNoResultsRow = document.getElementById('manual-no-results-row');

    const csvTableBody = document.querySelector('.history-table tbody'); // Asumiendo una sola tabla de historial CSV

    // --- Funciones para Modales ---
    const showModal = (overlayElement) => { if (overlayElement) { overlayElement.style.display = 'flex'; requestAnimationFrame(() => overlayElement.classList.add('active')); } };
    const hideModal = (overlayElement) => { if (overlayElement) { overlayElement.classList.remove('active'); overlayElement.addEventListener('transitionend', () => { if (!overlayElement.classList.contains('active')) { overlayElement.style.display = 'none'; } }, { once: true }); } };

    // Modal Agregar Manual Simple
    window.openManualNicheModal = () => { if (manualNicheForm) manualNicheForm.reset(); showModal(manualModalOverlay); };
    window.closeManualNicheModal = () => { hideModal(manualModalOverlay); };
    if (manualModalOverlay) { manualModalOverlay.addEventListener('click', (e) => { if (e.target === manualModalOverlay) closeManualNicheModal(); }); }

    // Modal Agregar en Lote
    window.openBulkManualAddModal = () => { if(bulkManualAddForm) bulkManualAddForm.reset(); if(bulkFeedback) bulkFeedback.textContent = ''; if(bulkErrorsList) bulkErrorsList.innerHTML = ''; showModal(bulkManualAddModalOverlay); };
    window.closeBulkManualAddModal = () => { hideModal(bulkManualAddModalOverlay); };
     if (bulkManualAddModalOverlay) { bulkManualAddModalOverlay.addEventListener('click', (e) => { if (e.target === bulkManualAddModalOverlay) closeBulkManualAddModal(); }); }

    // Cerrar modales con Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (manualModalOverlay?.classList.contains('active')) closeManualNicheModal();
            if (bulkManualAddModalOverlay?.classList.contains('active')) closeBulkManualAddModal();
        }
    });

    // --- Filtro Tabla Manual ---
    if (manualSearchInput && manualTableBody) {
        manualSearchInput.addEventListener('input', () => {
            const searchTerm = manualSearchInput.value.toLowerCase().trim();
            const rows = manualTableBody.querySelectorAll('tr:not(.no-data-row)'); // Excluir fila "sin datos"
            let visibleCount = 0;

            rows.forEach(row => {
                const searchTerms = row.dataset.searchTerms || ''; // Leer términos de búsqueda del data attribute
                const isVisible = !searchTerm || searchTerms.includes(searchTerm);
                row.style.display = isVisible ? '' : 'none';
                if (isVisible) visibleCount++;
            });

            // Mostrar/ocultar mensaje "sin resultados"
            if (manualNoResultsRow) {
                 manualNoResultsRow.style.display = (visibleCount === 0 && rows.length > 0) ? 'table-row' : 'none';
            }
        });
    }

    // --- Editar Estado Manual (AJAX) ---
    if (manualTableBody) {
        manualTableBody.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.classList.contains('manual-niche-status')) {
                const id = target.dataset.id;
                const nuevoEstado = target.value;
                const selectElement = target; // Guardar referencia

                console.log(`Cambiando estado para ID ${id} a ${nuevoEstado}`);
                selectElement.disabled = true; // Deshabilitar mientras guarda

                try {
                    const response = await fetch(`/api/manual-tracking/${id}/estado`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: nuevoEstado })
                    });
                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(result.message || `Error ${response.status}`);
                    }

                    console.log(`Estado actualizado para ID ${id}`);
                    // Opcional: cambiar el color del tag/select visualmente
                    const statusCell = target.closest('td');
                    if(statusCell) {
                        // Quitar clases viejas y añadir la nueva (si tienes CSS para esto)
                        statusCell.className = `status-col status-${nuevoEstado}`;
                    }
                    // showFlashMessage('Estado actualizado.', 'success'); // Mostrar feedback

                } catch (error) {
                    console.error(`Error actualizando estado ID ${id}:`, error);
                    alert(`Error al actualizar estado: ${error.message}`);
                    // Revertir el select al valor anterior si falla? (Necesitarías guardar el valor original)
                    // target.value = valorOriginal;
                } finally {
                     selectElement.disabled = false; // Rehabilitar siempre
                }
            }
        });
    }

     // --- Borrar CSV (AJAX) ---
     if (csvTableBody) {
         csvTableBody.addEventListener('click', async (event) => {
             const target = event.target;
             const deleteButton = target.closest('.csv-delete-btn');

             if (deleteButton) {
                 event.preventDefault();
                 const uploadId = deleteButton.dataset.id;
                 const filename = deleteButton.dataset.filename || 'este archivo';

                 if (confirm(`¿Estás seguro de que quieres eliminar el registro y el archivo "${filename}"? Esta acción NO se puede deshacer.`)) {
                    deleteButton.disabled = true;
                    deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                     try {
                         const response = await fetch(`/api/auditoria/trackeo/uploads/${uploadId}`, {
                             method: 'DELETE'
                         });
                         const result = await response.json(); // Leer respuesta JSON

                         if (!response.ok || !result.success) {
                             throw new Error(result.message || `Error ${response.status}`);
                         }

                         console.log(`CSV Upload ${uploadId} eliminado.`);
                         // Eliminar fila de la tabla
                         const row = document.getElementById(`upload-row-${uploadId}`);
                         if (row) row.remove();
                         alert(result.message || 'Archivo CSV eliminado.'); // O usar showFlashMessage

                     } catch (error) {
                         console.error(`Error eliminando CSV ${uploadId}:`, error);
                         alert(`Error al eliminar: ${error.message}`);
                         deleteButton.disabled = false; // Rehabilitar si falló
                         deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
                     }
                 }
             }
         });
     }

     // --- Agregar en Lote (AJAX) ---
     if (bulkManualAddForm) {
         bulkManualAddForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             const bulkData = bulkTextarea.value;
             const submitButton = bulkManualAddForm.querySelector('button[type="submit"]');
             if (!bulkData.trim()) {
                 showError(bulkFeedback, "El área de texto está vacía.");
                 return;
             }

             submitButton.disabled = true;
             submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agregando...';
             hideError(bulkFeedback);
             if(bulkErrorsList) bulkErrorsList.innerHTML = '';

             try {
                const response = await fetch('/api/manual-tracking/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bulkData: bulkData })
                });
                const result = await response.json();

                if (!response.ok && !result.success) { // Permitir 207 con success: true
                    throw new Error(result.message || `Error ${response.status}`);
                }

                 // Mostrar mensaje de éxito y errores de formato si los hubo
                 bulkFeedback.textContent = result.message || 'Proceso completado.';
                 bulkFeedback.className = `feedback-message ${result.errors ? 'warning' : 'success'}`; // Warning si hubo errores de línea

                 if (result.errors && result.errors.length > 0 && bulkErrorsList) {
                     bulkErrorsList.innerHTML = '<strong>Líneas con formato incorrecto:</strong>';
                     result.errors.forEach(err => {
                         const li = document.createElement('li');
                         li.textContent = err;
                         bulkErrorsList.appendChild(li);
                     });
                 }

                 // Recargar la página después de un delay para ver los cambios
                 setTimeout(() => {
                     // location.reload(); // Recarga completa
                      // O podrías cerrar el modal y actualizar la tabla manualmente con otra llamada AJAX
                      closeBulkManualAddModal();
                      // Idealmente, harías fetch de los nuevos datos y actualizarías la tabla manual
                      // fetchAndRenderManualTable();
                      alert("Lote procesado. Refresca la página si no ves los cambios."); // Mensaje temporal
                 }, 2000);


             } catch(error) {
                 console.error("Error agregando en lote:", error);
                 showError(bulkFeedback, `Error: ${error.message}`);
             } finally {
                 submitButton.disabled = false;
                 submitButton.innerHTML = '<i class="fas fa-plus-circle"></i> Agregar Lote';
             }

         });
     }

    console.log("Auditoría Trackeo Manager inicializado.");
});