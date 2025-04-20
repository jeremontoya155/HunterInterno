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
    const desempenoFechaInput = document.getElementById('desempeno_fecha');

    // --- Funciones para Controlar Modales ---
    const showModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.style.display = 'flex';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    overlayElement.classList.add('modal-visible');
                });
            });
        }
    };

    const hideModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.classList.remove('modal-visible');
            overlayElement.addEventListener('transitionend', function handler() {
                if (!overlayElement.classList.contains('modal-visible')) {
                    overlayElement.style.display = 'none';
                }
                overlayElement.removeEventListener('transitionend', handler);
            }, { once: true });
        }
    };

    // --- Funciones para manejar estados ---
    const getEstadoClass = (estado) => {
        // Mapear los estados a sus clases CSS correspondientes
        const estadoMap = {
            'Al dia': 'activo',
            '1 - 5': 'inactivo',
            '5 a 15': 'prueba',
            '+15': 'baja'
        };
        
        const estadoNormalizado = estadoMap[estado] || estado;
        return `tag-estado tag-estado-${estadoNormalizado}`;
    };

    // Función para actualizar los estados en la tabla
    const updateEstadoStyles = () => {
        document.querySelectorAll('.tag-estado').forEach(element => {
            const estado = element.textContent.trim();
            element.className = getEstadoClass(estado);
        });
    };

    // --- Funciones Modal Vendedor (Agregar/Editar) ---
    window.openVendedorModal = (vendedorId = null) => {
        if (!vendedorForm || !vendedorModalOverlay) { 
            console.error("Elementos del modal de vendedor no encontrados."); 
            return; 
        }
        
        vendedorForm.reset();
        if(desempenoFeedback) { 
            desempenoFeedback.textContent = ''; 
            desempenoFeedback.className = 'feedback-message'; 
        }

        if (vendedorId) { // MODO EDITAR
            const card = document.getElementById(`vendedor-card-${vendedorId}`);
            if (!card?.dataset?.vendedor) { 
                console.error(`Datos no encontrados para vendedor ID: ${vendedorId}`); 
                alert("Error: No se pudieron cargar los datos del vendedor."); 
                return; 
            }
            
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
                if(modalEstado) modalEstado.value = data.estado || 'Al dia';
                if(modalNotas) modalNotas.value = data.notas_auditoria || '';
            } catch (e) { 
                console.error("Error parseando datos del vendedor:", e); 
                alert("Error al cargar datos del vendedor."); 
                return; 
            }
        } else { // MODO AGREGAR
            if(vendedorModalLabel) vendedorModalLabel.textContent = 'Agregar Nuevo Vendedor';
            if(vendedorIdInput) vendedorIdInput.value = '';
        }
        showModal(vendedorModalOverlay);
    };

    window.closeVendedorModal = () => { 
        if (vendedorModalOverlay) hideModal(vendedorModalOverlay); 
    };

    // --- Funciones Modal Desempeño Diario ---
    window.openDesempenoModal = (vendedorId) => {
        if (!desempenoModalOverlay || !desempenoVendedorIdInput || !desempenoModalLabel || !desempenoAccountsContainer || !desempenoFeedback) {
            console.error("Elementos del modal de desempeño no encontrados.");
            alert("Error al abrir el modal de desempeño.");
            return;
        }
        
        const card = document.getElementById(`vendedor-card-${vendedorId}`);
        if (!card?.dataset?.vendedor) { 
            console.error(`Datos no encontrados para vendedor (desempeño) ID: ${vendedorId}`); 
            alert("Error: No se pudieron cargar datos."); 
            return; 
        }
        
        try {
            const data = JSON.parse(card.dataset.vendedor);
            desempenoVendedorIdInput.value = vendedorId;
            desempenoModalLabel.textContent = `Registrar Desempeño - ${data.nombre}`;
            desempenoFeedback.textContent = '';
            desempenoFeedback.className = 'feedback-message';

            // Limpiar contenedor y generar inputs
            desempenoAccountsContainer.innerHTML = '';
            if (data.cuentas_asignadas && Array.isArray(data.cuentas_asignadas) && data.cuentas_asignadas.length > 0) {
                data.cuentas_asignadas.forEach(cuenta => {
                    const cuentaIdSeguro = cuenta.replace(/[^a-zA-Z0-9_-]/g, '_');
                    const group = document.createElement('div');
                    group.className = 'account-input-group';
                    group.dataset.accountName = cuenta;

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
                            <label for="man_${cuentaIdSeguro}">Msgs Man:</label>
                            <input type="number" id="man_${cuentaIdSeguro}" name="mensajes_manuales" min="0" value="0" placeholder="Manual" required>
                        </div>
                    `;
                    desempenoAccountsContainer.appendChild(group);
                });
            } else {
                desempenoAccountsContainer.innerHTML = '<p class="no-data">Este vendedor no tiene cuentas asignadas.</p>';
            }
            
            if (desempenoFechaInput && !desempenoFechaInput.value) {
                desempenoFechaInput.valueAsDate = new Date();
            }
            
            showModal(desempenoModalOverlay);
        } catch(e) { 
            console.error("Error preparando modal desempeño:", e); 
            alert("Error al preparar registro."); 
        }
    };

    window.closeDesempenoModal = () => { 
        if (desempenoModalOverlay) hideModal(desempenoModalOverlay); 
    };

    // Enviar Formulario Desempeño (AJAX)
    window.submitDesempeno = async (event) => {
        if(event) event.preventDefault();
        if (!desempenoForm || !desempenoFeedback || !desempenoVendedorIdInput || !desempenoFechaInput || !desempenoAccountsContainer) {
            console.error("Faltan elementos esenciales para enviar desempeño."); 
            return;
        }
        
        const vendedorId = desempenoVendedorIdInput.value;
        const fecha = desempenoFechaInput.value;
        const notasAuditoria = document.getElementById('desempeno_notas')?.value || '';
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
                    notas_auditoria: notasAuditoria
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

    // --- Inicialización ---
    // Actualizar estilos de estado al cargar la página
    updateEstadoStyles();

    // Observar cambios en el DOM para aplicar estilos a nuevos elementos de estado
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                updateEstadoStyles();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // --- Listeners para cerrar modales ---
    [vendedorModalOverlay, desempenoModalOverlay].forEach(overlay => {
        if(overlay) { 
            overlay.addEventListener('click', (event) => { 
                if (event.target === overlay) { 
                    hideModal(overlay); 
                } 
            }); 
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (vendedorModalOverlay?.classList.contains('modal-visible')) closeVendedorModal();
            if (desempenoModalOverlay?.classList.contains('modal-visible')) closeDesempenoModal();
        }
    });
});