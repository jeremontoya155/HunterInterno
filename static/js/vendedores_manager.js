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
    const modalPlan = document.getElementById('modal_plan'); // Referencia añadida
    const modalTipoCuenta = document.getElementById('modal_tipo_cuenta'); // Referencia añadida
    const modalIngreso = document.getElementById('modal_fecha_ingreso');
    const modalEstado = document.getElementById('modal_estado');
    const modalNotas = document.getElementById('modal_notas_auditoria');

    // Referencias Modal Desempeño (Sin cambios aquí)
    const desempenoModalOverlay = document.getElementById('desempenoModalOverlay');
    const desempenoForm = document.getElementById('desempeno-form');
    const desempenoVendedorIdInput = document.getElementById('desempeno_vendedor_id');
    const desempenoAccountsContainer = document.getElementById('desempeno-accounts-container');
    const desempenoModalLabel = document.getElementById('desempenoModalLabel');
    const desempenoFeedback = document.getElementById('desempeno-feedback');
    const desempenoFechaInput = document.getElementById('desempeno_fecha');

    // --- Funciones para Controlar Modales --- (Sin cambios aquí)
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

    // --- Funciones para manejar estados --- (Sin cambios aquí)
    const getEstadoClass = (estado) => {
        // Mapear los estados a sus clases CSS correspondientes
        const estadoMap = {
            'Al dia': 'verde', // Ajusta estas clases según tu CSS (ej. tag-estado-verde)
            'Al día': 'verde',
            'Activo': 'verde',
            '1 - 5': 'amarillo',
            '5 a 15': 'naranja',
            '+15': 'rojo',
            'Inactivo': 'gris'
            // ...otros estados
        };
        // Normalizar y limpiar el estado antes de buscar en el mapa
        const estadoLimpio = String(estado || '').toLowerCase().trim();
        let claseSufijo = 'default'; // Clase por defecto

        // Buscar la clase correspondiente
        for (const key in estadoMap) {
            if (estadoLimpio === key.toLowerCase().trim()) {
                claseSufijo = estadoMap[key];
                break;
            }
        }
        // Construir la clase completa
        return `tag-estado tag-estado-${claseSufijo}`; // Asume prefijo 'tag-estado-'
    };


    // Función para actualizar los estilos de estado en la tabla y cards
    const updateEstadoStyles = () => {
        document.querySelectorAll('.tag-estado').forEach(element => {
            // Leer el texto del estado directamente del elemento
            const estadoTexto = element.textContent.trim();
            // Aplicar la clase CSS correcta basada en el texto
            element.className = getEstadoClass(estadoTexto);
        });
    };

    // --- Funciones Modal Vendedor (Agregar/Editar) ---
    // *** MODIFICADO: openVendedorModal ***
    window.openVendedorModal = (vendedorId = null) => {
        if (!vendedorForm || !vendedorModalOverlay) {
            console.error("Elementos del modal de vendedor no encontrados.");
            return;
        }

        vendedorForm.reset(); // Limpia todos los campos del formulario
        vendedorIdInput.value = ''; // Asegura que el ID esté limpio
        modalNombre.defaultValue = ''; // Limpia el valor por defecto para la lógica del listener

        // Resetear feedback si existe
        if(desempenoFeedback) {
            desempenoFeedback.textContent = '';
            desempenoFeedback.className = 'feedback-message';
        }

        // Asegurarse de que los campos autocompletables estén editables y sin título especial
        if(modalCuentas) {
            modalCuentas.readOnly = false;
            modalCuentas.title = "";
            modalCuentas.placeholder = "Se autocompletarán si selecciona un cliente existente"; // Placeholder original
        }
        if(modalTipoCuenta) {
            modalTipoCuenta.readOnly = false;
            modalTipoCuenta.title = "";
            modalTipoCuenta.placeholder = "Se autocompletará si selecciona un cliente"; // Placeholder original
        }

        if (vendedorId) { // MODO EDITAR
            const card = document.getElementById(`vendedor-card-${vendedorId}`);
            if (!card?.dataset?.vendedor) {
                console.error(`Datos no encontrados para vendedor ID: ${vendedorId}`);
                alert("Error: No se pudieron cargar los datos del cliente.");
                return;
            }

            try {
                const data = JSON.parse(card.dataset.vendedor);
                console.log("Editando datos:", data); // Log para depurar

                vendedorModalLabel.textContent = `Editar Cliente: ${data.nombre}`;
                vendedorIdInput.value = data.id; // Establecer ID oculto

                // Llenar campos desde 'data'
                if(modalNombre) {
                    modalNombre.value = data.nombre || '';
                    modalNombre.defaultValue = data.nombre || ''; // Guardar nombre original
                }
                if(modalManager) modalManager.value = data.manager_asignado || '';

                // Inicialmente, llenar con los datos guardados del vendedor
                // El listener 'change' en modalNombre los sobrescribirá si el cliente existe en patrimonio
                if(modalCuentas) modalCuentas.value = (data.cuentas_asignadas && Array.isArray(data.cuentas_asignadas)) ? data.cuentas_asignadas.join(', ') : '';
                if(modalTipoCuenta) modalTipoCuenta.value = data.tipo_cuenta || 'cliente'; // Usar tipo guardado o default

                if(modalCumplimiento) modalCumplimiento.value = data.porcentaje_cumplimiento || 0;
                if(modalObjetivo) modalObjetivo.value = data.objetivo_mensual || 0;
                if(modalPlan) modalPlan.value = data.plan || ''; // Llenar plan
                if(modalIngreso) modalIngreso.value = data.fecha_ingreso ? data.fecha_ingreso.split('T')[0] : '';
                if(modalEstado) modalEstado.value = data.estado || 'Al dia'; // Ajusta el default si es necesario
                if(modalNotas) modalNotas.value = data.notas_auditoria || '';

                // *** IMPORTANTE: Disparar evento 'change' DESPUÉS de llenar el nombre ***
                // para que la lógica de autocomplete se ejecute si el nombre existe en patrimonio
                if (modalNombre.value && typeof clientDetailsData !== 'undefined') {
                    // Usar setTimeout para asegurar que el navegador procese el valor antes del evento
                    setTimeout(() => {
                        modalNombre.dispatchEvent(new Event('change', { bubbles: true }));
                    }, 0);
                }

            } catch (e) {
                console.error("Error parseando datos del vendedor:", e);
                alert("Error al cargar datos del cliente.");
                return;
            }
        } else { // MODO AGREGAR
            vendedorModalLabel.textContent = 'Agregar Nuevo Cliente';
            // Los campos ya están reseteados por vendedorForm.reset()
            // Podemos establecer valores por defecto si es necesario
            if(modalEstado) modalEstado.value = 'Al dia'; // Default estado
            if(modalPlan) modalPlan.value = 'base';   // Default plan
            if(modalTipoCuenta) modalTipoCuenta.value = 'cliente'; // Default tipo
            if(modalCumplimiento) modalCumplimiento.value = '0.00';
            if(modalObjetivo) modalObjetivo.value = '0';
        }
        showModal(vendedorModalOverlay);
    };


    window.closeVendedorModal = () => {
        if (vendedorModalOverlay) hideModal(vendedorModalOverlay);
    };

    // --- Funciones Modal Desempeño Diario --- (Sin cambios aquí)
    window.openDesempenoModal = (vendedorId) => {
        if (!desempenoModalOverlay || !desempenoVendedorIdInput || !desempenoModalLabel || !desempenoAccountsContainer || !desempenoFeedback) {
            console.error("Elementos del modal de desempeño no encontrados.");
            alert("Error al abrir el modal de desempeño.");
            return;
        }

        const card = document.getElementById(`vendedor-card-${vendedorId}`);
        // Usar los datos del vendedor *actualmente guardados* para obtener las cuentas
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

            // Limpiar contenedor y generar inputs para las CUENTAS ASIGNADAS al vendedor
            desempenoAccountsContainer.innerHTML = '';
            const cuentasAsignadas = data.cuentas_asignadas || []; // Usar las cuentas del vendedor

            if (cuentasAsignadas && Array.isArray(cuentasAsignadas) && cuentasAsignadas.length > 0) {
                cuentasAsignadas.forEach(cuenta => {
                    if (!cuenta) return; // Saltar si la cuenta es null o vacía
                    const cuentaIdSeguro = cuenta.replace(/[^a-zA-Z0-9_-]/g, '_'); // Crear ID seguro
                    const group = document.createElement('div');
                    group.className = 'account-input-group';
                    group.dataset.accountName = cuenta; // Guardar nombre original

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
                desempenoAccountsContainer.innerHTML = '<p class="no-data">Este cliente no tiene cuentas Instagram asignadas.</p>';
            }

            // Establecer fecha de hoy si no hay valor
            if (desempenoFechaInput && !desempenoFechaInput.value) {
                const today = new Date();
                // Ajustar por zona horaria para obtener la fecha local correcta
                 const offset = today.getTimezoneOffset();
                 const localToday = new Date(today.getTime() - (offset * 60 * 1000));
                 desempenoFechaInput.value = localToday.toISOString().split('T')[0];
                // O más simple si no hay problemas de zona horaria:
                // desempenoFechaInput.valueAsDate = new Date();
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

    // Enviar Formulario Desempeño (AJAX) (Sin cambios aquí)
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
        if (submitButton) submitButton.disabled = true; // Deshabilitar botón

        const desempenoData = [];
        accountGroups.forEach(group => {
            const cuentaNombre = group.dataset.accountName;
            const mensajesInput = group.querySelector('input[name="mensajes"]');
            const respuestasInput = group.querySelector('input[name="respuestas"]');
            const manualesInput = group.querySelector('input[name="mensajes_manuales"]');

            // Asegurarse que todos los elementos existen antes de leer valores
            if (cuentaNombre && mensajesInput && respuestasInput && manualesInput) {
                desempenoData.push({
                    cuenta: cuentaNombre,
                    mensajes: parseInt(mensajesInput.value, 10) || 0, // Default a 0 si es inválido
                    respuestas: parseInt(respuestasInput.value, 10) || 0,
                    mensajes_manuales: parseInt(manualesInput.value, 10) || 0
                });
            } else {
                 console.warn(`Grupo de cuenta incompleto omitido: ${cuentaNombre}`);
            }
        });

        if (!vendedorId || !fecha) {
            desempenoFeedback.textContent = 'Error: Falta ID de cliente o fecha.';
            desempenoFeedback.className = 'feedback-message error';
            if (submitButton) submitButton.disabled = false; // Rehabilitar botón
            return;
        }
         // Validar que hay datos de desempeño si hay grupos de cuentas
         if (accountGroups.length > 0 && desempenoData.length === 0) {
             console.error("Error: No se pudieron recolectar datos de desempeño de los inputs.");
             desempenoFeedback.textContent = 'Error: No se pudieron leer los datos de las cuentas.';
             desempenoFeedback.className = 'feedback-message error';
             if (submitButton) submitButton.disabled = false;
             return;
         }


        try {
            const response = await fetch('/vendedores/desempeno', { // Endpoint correcto
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendedor_id: vendedorId,
                    fecha: fecha,
                    desempeno: desempenoData, // Array de objetos {cuenta, mensajes, respuestas, mensajes_manuales}
                    notas_auditoria: notasAuditoria
                })
            });

            const result = await response.json();

            if (!response.ok) {
                // Lanzar error para que lo capture el catch
                throw new Error(result.message || `Error del servidor: ${response.status}`);
            }

            // Éxito
            desempenoFeedback.textContent = result.message || '¡Desempeño guardado!';
            desempenoFeedback.className = 'feedback-message success';

            // Recargar la página después de un breve retraso para ver los cambios
            setTimeout(() => {
                closeDesempenoModal();
                location.reload(); // Recarga la página /vendedores
            }, 1500);

        } catch (error) {
            // Manejo de errores de red o del servidor (lanzados desde el bloque try)
            console.error('Error al enviar desempeño:', error);
            desempenoFeedback.textContent = `Error: ${error.message}`;
            desempenoFeedback.className = 'feedback-message error';
        } finally {
            // Asegurarse de rehabilitar el botón en cualquier caso (éxito o error)
            // excepto si ya se programó el reload
             if (!desempenoFeedback.classList.contains('success')) {
                 if (submitButton) submitButton.disabled = false;
             }
        }
    };


    // Asociar submitDesempeno al evento submit del formulario si existe
    if(desempenoForm) {
        desempenoForm.addEventListener('submit', submitDesempeno);
    }


    // *** NUEVO: Event Listener para Autocomplete en Nombre Cliente ***
    if (modalNombre && modalCuentas && modalTipoCuenta && typeof clientDetailsData !== 'undefined') {
        console.log("Asignando listener de autocomplete a modal_nombre."); // Log para confirmar

        // Usamos 'change' que se dispara cuando el valor cambia y el input pierde el foco
        // o cuando se selecciona un item del datalist. 'input' se dispara con cada tecla.
        modalNombre.addEventListener('change', () => {
            const selectedClientName = modalNombre.value.trim();
            // Usar la variable global 'clientDetailsData' definida en el EJS
            const clientData = clientDetailsData[selectedClientName]; // Búsqueda case-sensitive

            console.log(`Evento 'change' en modal_nombre. Valor: "${selectedClientName}"`); // Log

            if (clientData) {
                // Cliente encontrado en los datos de patrimonio
                console.log(`Cliente encontrado en patrimonio: ${selectedClientName}. Autocompletando...`);
                modalCuentas.value = (clientData.usuarios || []).join(', ');
                modalTipoCuenta.value = clientData.tipo_cuenta || 'cliente'; // Usar tipo encontrado o default

                // Opcional: Marcar como autocompletado y/o hacerlo read-only
                // modalCuentas.readOnly = true;
                // modalTipoCuenta.readOnly = true;
                modalCuentas.title = "Autocompletado desde Patrimonio";
                modalTipoCuenta.title = "Autocompletado desde Patrimonio";

            } else {
                // Cliente NO encontrado (nombre nuevo o cambio a uno no existente)
                console.log(`Cliente "${selectedClientName}" no encontrado en patrimonio.`);

                // Solo limpiar/resetear si estamos en modo AGREGAR (sin vendedorId)
                // O si estamos en modo EDITAR y el nombre ACTUAL es DIFERENTE al nombre ORIGINAL cargado.
                const vendedorId = vendedorIdInput.value;
                const originalName = modalNombre.defaultValue || ''; // Nombre original al abrir

                if (!vendedorId || (vendedorId && selectedClientName !== originalName)) {
                    console.log("Modo Agregar o Nombre cambiado en Editar: Reseteando campos relacionados.");
                    modalCuentas.value = ''; // Limpiar para entrada manual
                    modalTipoCuenta.value = 'cliente'; // Resetear a default

                    // Asegurar que sean editables y quitar títulos especiales
                    modalCuentas.readOnly = false;
                    modalTipoCuenta.readOnly = false;
                    modalCuentas.title = "";
                    modalTipoCuenta.title = "";
                    modalCuentas.placeholder = "usuario1, usuario2"; // Placeholder genérico
                    modalTipoCuenta.placeholder = "Ej: cliente, propio"; // Placeholder genérico

                } else {
                    // Estamos en modo Editar y el nombre es el mismo que el original (o se volvió a él).
                    // NO hacemos nada aquí para permitir que ediciones manuales previas en Cuentas/Tipo persistan.
                    console.log("Modo Editar y nombre no cambiado (o revertido): No se resetean campos.");
                    // Asegurar que sean editables si previamente se marcaron como readOnly
                     modalCuentas.readOnly = false;
                     modalTipoCuenta.readOnly = false;
                     modalCuentas.title = ""; // Limpiar título si lo había
                     modalTipoCuenta.title = "";
                }
            }
        });
    } else {
         console.warn("No se pudo asignar el listener de autocomplete: Faltan elementos del DOM o clientDetailsData.");
         if(typeof clientDetailsData === 'undefined') {
             console.error("La variable 'clientDetailsData' NO está definida. Verifica que se pase correctamente desde EJS.");
         }
    }


    // --- Inicialización --- (Sin cambios aquí)
    // Actualizar estilos de estado al cargar la página
    updateEstadoStyles();

    // Observar cambios en el DOM para aplicar estilos a nuevos elementos de estado (si se añaden dinámicamente)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    // Buscar elementos '.tag-estado' dentro de los nodos añadidos
                    if (node.nodeType === 1) { // Si es un elemento
                        if (node.classList.contains('tag-estado')) {
                             element.className = getEstadoClass(node.textContent.trim());
                        }
                         node.querySelectorAll('.tag-estado').forEach(element => {
                             element.className = getEstadoClass(element.textContent.trim());
                         });
                    }
                });
            }
        });
    });


    // Observar el body o un contenedor más específico si es posible
    observer.observe(document.body, {
        childList: true, // Observar hijos directos
        subtree: true    // Observar todos los descendientes
    });

    // --- Listeners para cerrar modales --- (Sin cambios aquí)
    [vendedorModalOverlay, desempenoModalOverlay].forEach(overlay => {
        if(overlay) {
            overlay.addEventListener('click', (event) => {
                // Cerrar solo si se hace clic directamente en el overlay (fondo)
                if (event.target === overlay) {
                    hideModal(overlay);
                }
            });
        }
    });

    // Cerrar modales con la tecla Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            // Verificar cuál modal está visible y cerrarlo
            if (vendedorModalOverlay?.classList.contains('modal-visible')) {
                closeVendedorModal();
            } else if (desempenoModalOverlay?.classList.contains('modal-visible')) {
                closeDesempenoModal();
            }
        }
    });

     // Llamada inicial para asegurar estilos correctos al cargar
     updateEstadoStyles();

}); // Fin DOMContentLoaded