// static/js/vendedores_manager.js
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


    const desempenoModalOverlay = document.getElementById('desempenoModalOverlay');
    const desempenoForm = document.getElementById('desempeno-form');
    const desempenoVendedorIdInput = document.getElementById('desempeno_vendedor_id');
    const desempenoAccountsContainer = document.getElementById('desempeno-accounts-container');
    const desempenoModalLabel = document.getElementById('desempenoModalLabel');
    const desempenoFeedback = document.getElementById('desempeno-feedback');

    // Referencias Dashboard y Filtros
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
            overlayElement.offsetHeight; // Reflow
            overlayElement.classList.add('modal-visible');
        }
    };
    const hideModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.classList.remove('modal-visible');
            setTimeout(() => {
                 if (!overlayElement.classList.contains('modal-visible')) {
                    overlayElement.style.display = 'none';
                 }
            }, 400); // Coincide con la duración de la transición CSS
        }
    };

    // Abrir Modal Agregar/Editar Vendedor
    window.openVendedorModal = (vendedorId = null) => {
        vendedorForm.reset(); // Limpia siempre
        desempenoFeedback.textContent = ''; // Limpia feedback del otro modal por si acaso
        desempenoFeedback.className = 'feedback-message';

        if (vendedorId) { // MODO EDITAR
            const card = document.getElementById(`vendedor-card-${vendedorId}`);
            if (!card || !card.dataset.vendedor) { console.error("Datos no encontrados:", vendedorId); alert("Error: No se pudieron cargar datos."); return; }
            try {
                const data = JSON.parse(card.dataset.vendedor);
                vendedorModalLabel.textContent = `Editar Vendedor: ${data.nombre}`;
                vendedorIdInput.value = data.id;
                modalNombre.value = data.nombre || '';
                modalManager.value = data.manager_asignado || '';
                modalCuentas.value = (data.cuentas_asignadas || []).join(', ');
                modalCumplimiento.value = data.porcentaje_cumplimiento || 0;
                modalObjetivo.value = data.objetivo_mensual || 0;
                modalIngreso.value = data.fecha_ingreso ? data.fecha_ingreso.split('T')[0] : '';
                modalEstado.value = data.estado || 'activo';
                modalNotas.value = data.notas_auditoria || '';
            } catch (e) { console.error("Error parseando datos:", e); alert("Error al cargar datos."); return; }
        } else { // MODO AGREGAR
            vendedorModalLabel.textContent = 'Agregar Nuevo Vendedor';
            vendedorIdInput.value = ''; // Asegurar que ID esté vacío
        }
        showModal(vendedorModalOverlay);
    };
    window.closeVendedorModal = () => hideModal(vendedorModalOverlay);

    // Abrir Modal Registrar Desempeño
    window.openDesempenoModal = (vendedorId) => {
        const card = document.getElementById(`vendedor-card-${vendedorId}`);
         if (!card || !card.dataset.vendedor) { console.error("Datos no encontrados (desempeño):", vendedorId); alert("Error: No se pudieron cargar datos."); return; }
         try {
            const data = JSON.parse(card.dataset.vendedor);
            desempenoVendedorIdInput.value = vendedorId;
            desempenoModalLabel.textContent = `Registrar Desempeño - ${data.nombre}`;
            desempenoFeedback.textContent = '';
            desempenoFeedback.className = 'feedback-message';
            // Limpiar contenedor y generar inputs
            desempenoAccountsContainer.innerHTML = '';
            if (data.cuentas_asignadas && data.cuentas_asignadas.length > 0) {
                 data.cuentas_asignadas.forEach(cuenta => {
                    const cuentaId = cuenta.replace(/[^a-zA-Z0-9_]/g, '_');
                    const group = document.createElement('div');
                    group.className = 'account-input-group';
                    group.innerHTML = `
                        <span class="account-name" data-account-name="${cuenta}" title="${cuenta}">${cuenta}</span>
                        <label for="msg_${cuentaId}">Msgs:</label>
                        <input type="number" id="msg_${cuentaId}" name="mensajes" min="0" value="0" placeholder="Msgs">
                        <label for="rpt_${cuentaId}">Rpts:</label>
                        <input type="number" id="rpt_${cuentaId}" name="respuestas" min="0" value="0" placeholder="Rpts">
                    `;
                    desempenoAccountsContainer.appendChild(group);
                 });
            } else {
                desempenoAccountsContainer.innerHTML = '<p class="no-data">Este vendedor no tiene cuentas asignadas.</p>';
            }
            showModal(desempenoModalOverlay);
         } catch(e) { console.error("Error preparando modal desempeño:", e); alert("Error al preparar registro."); }
    };
    window.closeDesempenoModal = () => hideModal(desempenoModalOverlay);

    // Enviar Formulario Desempeño (AJAX)
    window.submitDesempeno = async (event) => {
        event.preventDefault();
        const vendedorId = desempenoVendedorIdInput.value;
        const fecha = document.getElementById('desempeno_fecha').value;
        const accountGroups = desempenoAccountsContainer.querySelectorAll('.account-input-group');
        desempenoFeedback.textContent = 'Guardando...';
        desempenoFeedback.className = 'feedback-message';

        const desempenoData = [];
        accountGroups.forEach(group => {
            const cuentaNombre = group.querySelector('.account-name')?.dataset.accountName;
            const mensajesInput = group.querySelector('input[name="mensajes"]');
            const respuestasInput = group.querySelector('input[name="respuestas"]');
            if (cuentaNombre && mensajesInput && respuestasInput) {
                 desempenoData.push({ cuenta: cuentaNombre, mensajes: mensajesInput.value || 0, respuestas: respuestasInput.value || 0 });
            }
        });

        if (!vendedorId || !fecha) { desempenoFeedback.textContent = 'Error: Falta ID o fecha.'; desempenoFeedback.className = 'feedback-message error'; return; }
        // Permitir enviar aunque no haya cuentas (para limpiar datos si fuera necesario?) O validar:
        if (accountGroups.length > 0 && desempenoData.length === 0) {
            console.warn("Se detectaron grupos de cuentas pero no se pudieron leer datos.");
            desempenoFeedback.textContent = 'Error al leer datos de las cuentas.'; desempenoFeedback.className = 'feedback-message error'; return;
        }
         if (accountGroups.length === 0) {
            desempenoFeedback.textContent = 'No hay cuentas asignadas para registrar.';
            desempenoFeedback.className = 'feedback-message error';
             // No enviar si no hay cuentas, o enviar vacío si se quiere limpiar
            // return;
        }

        try {
            const response = await fetch('/vendedores/desempeno', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendedor_id: vendedorId, fecha: fecha, desempeno: desempenoData })
            });
            const result = await response.json();
            if (response.ok && result.success) {
                desempenoFeedback.textContent = result.message || '¡Guardado!';
                desempenoFeedback.className = 'feedback-message success';
                setTimeout(() => { closeDesempenoModal(); location.reload(); }, 1200);
            } else { throw new Error(result.message || 'Error del servidor'); }
        } catch (error) {
            console.error('Error al enviar desempeño:', error);
            desempenoFeedback.textContent = `Error: ${error.message}`;
            desempenoFeedback.className = 'feedback-message error';
        }
    };

    // --- Lógica del Dashboard ---
    const updateDashboardUI = (data) => {
        if (!data) {
            console.error("updateDashboardUI recibió datos nulos o indefinidos.");
            return;
        }
        if (totalMessagesStat) {
            totalMessagesStat.textContent = (data.totalMensajes ?? 0).toLocaleString('es-ES');
        }
        if (dashboardErrorDiv) { dashboardErrorDiv.style.display = 'none'; dashboardErrorDiv.textContent = ''; }

        if (chartCanvas && data.chartData) {
            const labels = data.chartData.map(item => item.fecha);
            const values = data.chartData.map(item => item.cantidad);

            if (labels.length === 0 && values.length === 0) {
                 console.warn("No hay datos para mostrar en el gráfico para el rango seleccionado.");
                 if(messagesChart) { // Limpiar gráfico si existe
                    messagesChart.data.labels = [];
                    messagesChart.data.datasets[0].data = [];
                    messagesChart.update();
                 }
                 // Aquí podrías mostrar un mensaje en el canvas si quieres
                 // const ctx = chartCanvas.getContext('2d');
                 // ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
                 // ctx.textAlign = 'center';
                 // ctx.fillStyle = '#8b949e'; // Color secundario
                 // ctx.fillText("No hay datos en este rango de fechas", chartCanvas.width / 2, chartCanvas.height / 2);
                 return;
            }

            if (messagesChart) { // Actualizar gráfico existente
                messagesChart.data.labels = labels;
                messagesChart.data.datasets[0].data = values;
                messagesChart.update();
            } else { // Crear gráfico nuevo
                 const ctx = chartCanvas.getContext('2d');
                 messagesChart = new Chart(ctx, {
                     type: 'line',
                     data: {
                         labels: labels,
                         datasets: [{
                             label: 'Mensajes Enviados', data: values,
                             borderColor: 'rgba(52, 152, 219, 0.8)', backgroundColor: 'rgba(52, 152, 219, 0.1)',
                             borderWidth: 2.5, fill: true, tension: 0.4,
                             pointBackgroundColor: 'rgba(52, 152, 219, 1)', pointRadius: 3, pointHoverRadius: 6
                         }]
                     },
                     options: {
                        responsive: true, maintainAspectRatio: false,
                         scales: {
                             y: { beginAtZero: true, ticks: { color: '#8b949e' }, grid: { color: 'rgba(139, 148, 158, 0.1)' } },
                             x: {
                                type: 'time',
                                time: { unit: 'day', tooltipFormat: 'PP', displayFormats: { day: 'd MMM' } },
                                ticks: { color: '#8b949e', maxRotation: 0, minRotation: 0, autoSkipPadding: 15 },
                                grid: { display: false }
                             }
                         },
                         plugins: { legend: { display: false }, tooltip: { /* ... opciones tooltip ... */ } },
                         interaction: { mode: 'nearest', axis: 'x', intersect: false }
                     }
                 });
            }
        } else {
             console.warn("Canvas de gráfico no encontrado o datos del gráfico inválidos:", chartCanvas, data ? data.chartData : 'data undefined');
        }
    };

    const fetchDashboardData = async (from, to) => {
        if (!from || !to) { console.warn("Fechas inválidas."); return; }
        if (chartLoadingSpinner) chartLoadingSpinner.style.display = 'block';
        if (dashboardErrorDiv) dashboardErrorDiv.style.display = 'none';

        try {
            const response = await fetch(`/vendedores/dashboard-data?from=${from}&to=${to}`);
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Error ${response.status}`); }
            const data = await response.json();
            updateDashboardUI(data); // Actualizar UI con nuevos datos
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            if (dashboardErrorDiv) { dashboardErrorDiv.textContent = `Error: ${error.message}`; dashboardErrorDiv.style.display = 'block'; }
            updateDashboardUI({ totalMensajes: 0, chartData: [] }); // Limpiar UI en caso de error
        } finally {
            if (chartLoadingSpinner) chartLoadingSpinner.style.display = 'none';
        }
    };

    // Listener Formulario Fechas Dashboard
    if (dateFilterForm) {
        dateFilterForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const fromDate = startDateInput.value;
            const toDate = endDateInput.value;
             if (fromDate && toDate && toDate < fromDate) {
                 alert("La fecha 'Hasta' no puede ser anterior a la fecha 'Desde'.");
                 return;
             }
            fetchDashboardData(fromDate, toDate);
        });
    }

    // Carga Inicial del Gráfico usando la variable global definida en EJS
    // Asegúrate que la variable `initialDashboardDataForChart` existe globalmente
    if (typeof initialDashboardDataForChart !== 'undefined') {
        console.log('DEBUG: Initial Dashboard Data for Chart (from global var):', initialDashboardDataForChart);
        updateDashboardUI(initialDashboardDataForChart);
    } else {
        console.warn("Variable global initialDashboardDataForChart no encontrada. Realizando fetch inicial si es posible.");
        // Fallback: hacer fetch inicial si la variable global no se cargó
        if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
             fetchDashboardData(startDateInput.value, endDateInput.value);
        } else {
            console.error("No se pudieron obtener las fechas iniciales para el fetch del dashboard.");
        }
    }

    // --- Filtro de Nombres de Vendedor ---
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

    // --- Listeners para cerrar modales ---
    [vendedorModalOverlay, desempenoModalOverlay].forEach(overlay => {
        if(overlay) { overlay.addEventListener('click', (event) => { if (event.target === overlay) { hideModal(overlay); } }); }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (vendedorModalOverlay?.classList.contains('modal-visible')) closeVendedorModal();
            else if (desempenoModalOverlay?.classList.contains('modal-visible')) closeDesempenoModal();
        }
    });

}); // Fin DOMContentLoaded