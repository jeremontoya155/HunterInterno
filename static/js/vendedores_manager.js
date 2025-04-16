document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias a los Elementos del DOM ---
    const vendedorModalOverlay = document.getElementById('vendedorModalOverlay');
    const vendedorForm = document.getElementById('vendedor-form');
    const vendedorModalLabel = document.getElementById('vendedorModalLabel');
    const vendedorIdInput = document.getElementById('vendedor_id');
    // Inputs del modal de vendedor (para edit/add)
    const modalNombre = document.getElementById('modal_nombre');
    const modalManager = document.getElementById('modal_manager_asignado');
    const modalCuentas = document.getElementById('modal_cuentas_asignadas');
    const modalCumplimiento = document.getElementById('modal_porcentaje_cumplimiento');
    const modalObjetivo = document.getElementById('modal_objetivo_mensual');
    const modalIngreso = document.getElementById('modal_fecha_ingreso');
    const modalEstado = document.getElementById('modal_estado');
    const modalNotas = document.getElementById('modal_notas_auditoria');
// Referencias Modal Desempeño
const desempenoModalOverlay = document.getElementById('desempenoModalOverlay');
const desempenoForm = document.getElementById('desempeno-form');
const desempenoVendedorIdInput = document.getElementById('desempeno_vendedor_id');
const desempenoAccountsContainer = document.getElementById('desempeno-accounts-container');
const desempenoModalLabel = document.getElementById('desempenoModalLabel');
const desempenoFeedback = document.getElementById('desempeno-feedback');
const desempenoFechaInput = document.getElementById('desempeno_fecha'); // Referencia al input de fecha

// Referencias Dashboard y Filtros (Si existen en la página donde se carga este JS)
const dateFilterForm = document.getElementById('date-filter-form');
const startDateInput = document.getElementById('dash_start_date');
const endDateInput = document.getElementById('dash_end_date');
const totalMessagesStat = document.getElementById('total-messages-stat');
const chartCanvas = document.getElementById('messagesChart');
const chartLoadingSpinner = document.getElementById('chart-loading-spinner');
const dashboardErrorDiv = document.getElementById('dashboard-error');
const sellerNameFilterInput = document.getElementById('seller-name-filter');
const sellerCardsGrid = document.querySelector('.vendedor-cards-grid');
const noSellerFoundMessage = document.getElementById('no-seller-found-message');

let messagesChart = null; // Variable para guardar la instancia del gráfico

// --- Funciones para Controlar Modales ---
const showModal = (overlayElement) => {
    if (overlayElement) {
        overlayElement.style.display = 'flex';
        // Pequeño delay para asegurar que el display:flex se aplique antes de añadir la clase
        requestAnimationFrame(() => {
             requestAnimationFrame(() => { // Doble requestAnimationFrame para mayor seguridad en algunos navegadores
                overlayElement.classList.add('modal-visible');
             });
        });
    }
};
const hideModal = (overlayElement) => {
    if (overlayElement) {
        overlayElement.classList.remove('modal-visible');
        // Esperar a que termine la transición CSS antes de ocultar con display:none
        overlayElement.addEventListener('transitionend', function handler() {
            if (!overlayElement.classList.contains('modal-visible')) {
                overlayElement.style.display = 'none';
            }
             // Remover el listener para que no se acumule si se abre/cierra rápido
             overlayElement.removeEventListener('transitionend', handler);
        }, { once: true }); // Ejecutar el listener solo una vez
    }
};

// --- Funciones Modal Vendedor (Agregar/Editar) ---
window.openVendedorModal = (vendedorId = null) => {
    if (!vendedorForm || !vendedorModalOverlay) { console.error("Elementos del modal de vendedor no encontrados."); return; }
    vendedorForm.reset();
    if(desempenoFeedback) { desempenoFeedback.textContent = ''; desempenoFeedback.className = 'feedback-message'; } // Limpiar feedback del otro modal

    if (vendedorId) { // MODO EDITAR
        const card = document.getElementById(`vendedor-card-${vendedorId}`);
        if (!card?.dataset?.vendedor) { console.error(`Datos no encontrados para vendedor ID: ${vendedorId}`); alert("Error: No se pudieron cargar los datos del vendedor."); return; }
        try {
            const data = JSON.parse(card.dataset.vendedor);
            vendedorModalLabel.textContent = `Editar Vendedor: ${data.nombre}`;
            vendedorIdInput.value = data.id;
            if(modalNombre) modalNombre.value = data.nombre || '';
            if(modalManager) modalManager.value = data.manager_asignado || '';
            if(modalCuentas) modalCuentas.value = (data.cuentas_asignadas || []).join(', ');
            if(modalCumplimiento) modalCumplimiento.value = data.porcentaje_cumplimiento || 0;
            if(modalObjetivo) modalObjetivo.value = data.objetivo_mensual || 0;
            if(modalIngreso) modalIngreso.value = data.fecha_ingreso ? data.fecha_ingreso.split('T')[0] : '';
            if(modalEstado) modalEstado.value = data.estado || 'activo';
            if(modalNotas) modalNotas.value = data.notas_auditoria || '';
        } catch (e) { console.error("Error parseando datos del vendedor:", e); alert("Error al cargar datos del vendedor."); return; }
    } else { // MODO AGREGAR
        if(vendedorModalLabel) vendedorModalLabel.textContent = 'Agregar Nuevo Vendedor';
        if(vendedorIdInput) vendedorIdInput.value = '';
    }
    showModal(vendedorModalOverlay);
};
window.closeVendedorModal = () => { if (vendedorModalOverlay) hideModal(vendedorModalOverlay); };

// --- Funciones Modal Desempeño Diario ---
window.openDesempenoModal = (vendedorId) => {
     if (!desempenoModalOverlay || !desempenoVendedorIdInput || !desempenoModalLabel || !desempenoAccountsContainer || !desempenoFeedback) {
        console.error("Elementos del modal de desempeño no encontrados.");
        alert("Error al abrir el modal de desempeño.");
        return;
    }
    const card = document.getElementById(`vendedor-card-${vendedorId}`);
    if (!card?.dataset?.vendedor) { console.error(`Datos no encontrados para vendedor (desempeño) ID: ${vendedorId}`); alert("Error: No se pudieron cargar datos."); return; }
    try {
        const data = JSON.parse(card.dataset.vendedor);
        desempenoVendedorIdInput.value = vendedorId;
        desempenoModalLabel.textContent = `Registrar Desempeño - ${data.nombre}`;
        desempenoFeedback.textContent = '';
        desempenoFeedback.className = 'feedback-message';

        // Limpiar contenedor y generar inputs
        desempenoAccountsContainer.innerHTML = ''; // Limpiar antes de añadir
        if (data.cuentas_asignadas && Array.isArray(data.cuentas_asignadas) && data.cuentas_asignadas.length > 0) {
             data.cuentas_asignadas.forEach(cuenta => {
                // Crear ID seguro para elementos HTML
                const cuentaIdSeguro = cuenta.replace(/[^a-zA-Z0-9_-]/g, '_'); // Reemplazar caracteres no válidos

                const group = document.createElement('div');
                group.className = 'account-input-group'; // Usar esta clase para estilizar cada fila
                group.dataset.accountName = cuenta; // Guardar nombre original en dataset

                group.innerHTML = `
                    <span class="account-name" title="${cuenta}">${cuenta}</span>
                    <div class="input-field">
                        <label for="msg_${cuentaIdSeguro}">Msgs Bot:</label>
                        <input type="number" id="msg_${cuentaIdSeguro}" name="mensajes" min="0" value="0" placeholder="Bot" required>
                    </div>
                    <div class="input-field">
                        <label for="rpt_${cuentaIdSeguro}">Resp:</label>
                        <input type="number" id="rpt_${cuentaIdSeguro}" name="respuestas" min="0" value="0" placeholder="Rpts" required>
                    </div>
                    <div class="input-field">
                        <label for="man_${cuentaIdSeguro}">Msgs Man:</label> <!-- <<< NUEVO LABEL -->
                        <input type="number" id="man_${cuentaIdSeguro}" name="mensajes_manuales" min="0" value="0" placeholder="Manual" required> <!-- <<< NUEVO INPUT -->
                    </div>
                `;
                desempenoAccountsContainer.appendChild(group);
             });
        } else {
            desempenoAccountsContainer.innerHTML = '<p class="no-data">Este vendedor no tiene cuentas asignadas.</p>';
        }
        // Establecer fecha por defecto a hoy si no tiene valor
        if (desempenoFechaInput && !desempenoFechaInput.value) {
             desempenoFechaInput.valueAsDate = new Date();
        }
        showModal(desempenoModalOverlay);
     } catch(e) { console.error("Error preparando modal desempeño:", e); alert("Error al preparar registro."); }
};
window.closeDesempenoModal = () => { if (desempenoModalOverlay) hideModal(desempenoModalOverlay); };

// Enviar Formulario Desempeño (AJAX)
window.submitDesempeno = async (event) => {
    if(event) event.preventDefault();
    if (!desempenoForm || !desempenoFeedback || !desempenoVendedorIdInput || !desempenoFechaInput || !desempenoAccountsContainer) {
        console.error("Faltan elementos esenciales para enviar desempeño."); return;
    }
    
    const vendedorId = desempenoVendedorIdInput.value;
    const fecha = desempenoFechaInput.value;
    const notasAuditoria = document.getElementById('desempeno_notas').value; // Nuevo: obtener notas
    const accountGroups = desempenoAccountsContainer.querySelectorAll('.account-input-group');
    const submitButton = desempenoForm.querySelector('button[type="submit"]');

    desempenoFeedback.textContent = 'Guardando...';
    desempenoFeedback.className = 'feedback-message info';

    const desempenoData = [];
    accountGroups.forEach(group => {
        const cuentaNombre = group.dataset.accountName;
        const mensajesInput = group.querySelector('input[name="mensajes"]');
        const respuestasInput = group.querySelector('input[name="respuestas"]');
        const manualesInput = group.querySelector('input[name="mensajes_manuales"]');

        if (cuentaNombre && mensajesInput && respuestasInput && manualesInput) {
            desempenoData.push({
                cuenta: cuentaNombre,
                mensajes: parseInt(mensajesInput.value, 10) || 0,
                respuestas: parseInt(respuestasInput.value, 10) || 0,
                mensajes_manuales: parseInt(manualesInput.value, 10) || 0
            });
        }
    });

    if (!vendedorId || !fecha) {
        desempenoFeedback.textContent = 'Error: Falta ID de vendedor o fecha.';
        desempenoFeedback.className = 'feedback-message error';
        return;
    }

    if (submitButton) submitButton.disabled = true;

    try {
        const response = await fetch('/vendedores/desempeno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vendedor_id: vendedorId,
                fecha: fecha,
                desempeno: desempenoData,
                notas_auditoria: notasAuditoria // Nuevo: enviar notas
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `Error del servidor: ${response.status}`);
        }

        desempenoFeedback.textContent = result.message || '¡Guardado!';
        desempenoFeedback.className = 'feedback-message success';
        setTimeout(() => {
            closeDesempenoModal();
            location.reload();
        }, 1500);

    } catch (error) {
        console.error('Error al enviar desempeño:', error);
        desempenoFeedback.textContent = `Error: ${error.message}`;
        desempenoFeedback.className = 'feedback-message error';
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
};
 // Asociar submitDesempeno al evento submit del formulario si existe
 if(desempenoForm) {
    desempenoForm.addEventListener('submit', submitDesempeno);
 }


// --- Lógica del Dashboard (Sin cambios necesarios aquí para mensajes manuales) ---
const updateDashboardUI = (data) => { /* ... (código existente) ... */ };
const fetchDashboardData = async (from, to) => { /* ... (código existente) ... */ };
if (dateFilterForm) { dateFilterForm.addEventListener('submit', (event) => { /* ... */ }); }
// Carga Inicial del Gráfico
if (typeof initialDashboardDataForChart !== 'undefined' && chartCanvas) {
    console.log('DEBUG: Carga inicial dashboard data:', initialDashboardDataForChart);
    updateDashboardUI(initialDashboardDataForChart);
} else if (chartCanvas && startDateInput?.value && endDateInput?.value) { // Solo intentar fetch si hay fechas iniciales
    console.warn("Variable global initialDashboardDataForChart no encontrada o canvas no existe. Realizando fetch inicial.");
    fetchDashboardData(startDateInput.value, endDateInput.value);
} else {
    // No hay datos iniciales ni fechas, no se puede cargar el dashboard
     if(chartLoadingSpinner) chartLoadingSpinner.style.display = 'none';
     console.warn("No hay datos iniciales ni fechas para cargar el dashboard.");
}


// --- Filtro de Nombres de Vendedor (Sin cambios) ---
if (sellerNameFilterInput && sellerCardsGrid) {
    sellerNameFilterInput.addEventListener('input', () => {
        const filterValue = sellerNameFilterInput.value.toLowerCase().trim();
        const cards = sellerCardsGrid.querySelectorAll('.vendedor-card');
        let visibleCount = 0;
        cards.forEach(card => {
            const vendedorNombre = card.querySelector('.vendedor-nombre')?.textContent.toLowerCase();
            const isVisible = !filterValue || (vendedorNombre && vendedorNombre.includes(filterValue));
            card.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });
        if (noSellerFoundMessage) { noSellerFoundMessage.style.display = (visibleCount === 0 && cards.length > 0) ? 'block' : 'none'; }
    });
}

// --- Listeners para cerrar modales (Sin cambios) ---
[vendedorModalOverlay, desempenoModalOverlay].forEach(overlay => {
    if(overlay) { overlay.addEventListener('click', (event) => { if (event.target === overlay) { hideModal(overlay); } }); }
});
document.addEventListener('keydown', (event) => {
    if (event.key === "Escape") {
        if (vendedorModalOverlay?.classList.contains('modal-visible')) closeVendedorModal();
        if (desempenoModalOverlay?.classList.contains('modal-visible')) closeDesempenoModal();
    }
});}); // Fin DOMContentLoaded
