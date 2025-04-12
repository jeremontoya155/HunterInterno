document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias Modal Patrimonio ---
    const patrimonioModalOverlay = document.getElementById('patrimonioModalOverlay');
    const patrimonioForm = document.getElementById('patrimonio-form');
    const patrimonioModalLabel = document.getElementById('patrimonioModalLabel');
    const cuentaIdInput = document.getElementById('cuenta_id');
    
    // Inputs del modal
    const modalTipoCuenta = document.getElementById('modal_tipo_cuenta');
    const modalClienteFieldGroup = document.getElementById('cliente-field-group');
    const modalNombreCliente = document.getElementById('modal_nombre_cliente');
    const modalUsuario = document.getElementById('modal_usuario');
    const modalCorreo = document.getElementById('modal_correo');
    const modalContrasena = document.getElementById('modal_contrasena');
    const modalContrasenaMail = document.getElementById('modal_contrasena_mail');
    const modalCelular = document.getElementById('modal_celular');
    const modalUltimaCargaCelular = document.getElementById('modal_ultima_carga_celular');
    const modalLink = document.getElementById('modal_link');
    const modalVerificacion = document.getElementById('modal_verificacion');
    const modalCeluAbierto = document.getElementById('modal_celu_abierto');
    const modalAutentificador = document.getElementById('modal_autentificador');
    const modalCodigosRespaldo = document.getElementById('modal_codigos_respaldo');
    const modalCodigosActualizados = document.getElementById('modal_codigos_actualizados_en');
    const modalCodigosValidez = document.getElementById('modal_codigos_validez_dias');

    // Verificar si los elementos principales existen
    if (!patrimonioModalOverlay || !patrimonioForm) {
        console.log("Elementos del modal de patrimonio no cargados en esta página.");
        return;
    }

    // --- Funciones para Mostrar/Ocultar Campo Cliente ---
    window.toggleClienteField = () => {
        if (modalTipoCuenta && modalClienteFieldGroup && modalNombreCliente) {
            const isCliente = modalTipoCuenta.value === 'cliente';
            modalClienteFieldGroup.style.display = isCliente ? '' : 'none';
            modalNombreCliente.required = isCliente;
            if (!isCliente) modalNombreCliente.value = '';
        }
    };
    // Llamada inicial
    toggleClienteField();

    // --- Funciones para Modal Patrimonio ---
    const showModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.style.display = 'flex';
            overlayElement.offsetHeight; // Reflow
            overlayElement.classList.add('modal-visible');
            const firstInput = overlayElement.querySelector('input:not([type="hidden"]):not([type="checkbox"]), select, textarea');
            if (firstInput) setTimeout(() => firstInput.focus(), 50);
        }
    };

    const hideModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.classList.remove('modal-visible');
            setTimeout(() => {
                if (!overlayElement.classList.contains('modal-visible')) {
                    overlayElement.style.display = 'none';
                }
            }, 400);
        }
    };

    window.openPatrimonioModal = (cuentaId = null) => {
        patrimonioForm.reset();
        patrimonioForm.classList.remove('was-validated');

        if (cuentaId) { // MODO EDITAR
            const row = document.getElementById(`cuenta-row-${cuentaId}`);
            if (!row || !row.dataset.cuenta) {
                console.error("Datos de cuenta no encontrados:", cuentaId);
                alert("Error: No se pudieron cargar los datos.");
                return;
            }
            
            try {
                const data = JSON.parse(row.dataset.cuenta);
                patrimonioModalLabel.textContent = `Editar Cuenta: ${data.usuario}`;
                cuentaIdInput.value = data.id;

                // Campos básicos
                modalTipoCuenta.value = data.tipo_cuenta || 'cliente';
                toggleClienteField();
                modalNombreCliente.value = data.nombre_cliente || '';
                modalUsuario.value = data.usuario || '';
                modalCorreo.value = data.correo || '';
                modalContrasena.placeholder = "Dejar vacío para no cambiar";
                modalLink.value = data.link || '';
                
                // Nuevos campos
                modalCelular.value = data.celular || '';
                modalUltimaCargaCelular.value = data.ultima_carga_celular || '';
                modalContrasenaMail.value = data.contrasena_mail || '';
                modalContrasenaMail.placeholder = "Dejar vacío para no cambiar";

                // Checkboxes y seguridad
                modalVerificacion.checked = data.verificacion || false;
                modalCeluAbierto.checked = data.celu_abierto || false;
                modalAutentificador.checked = data.autentificador || false;
                modalCodigosRespaldo.value = data.codigos_respaldo || '';
                modalCodigosActualizados.value = data.codigos_actualizados_en ? 
                    new Date(data.codigos_actualizados_en).toISOString().split('T')[0] : '';
                modalCodigosValidez.value = data.codigos_validez_dias || 7;

            } catch (e) {
                console.error("Error parseando datos de cuenta:", e);
                alert("Error al cargar datos para editar.");
                return;
            }
        } else { // MODO AGREGAR
            patrimonioModalLabel.textContent = 'Agregar Cuenta a Patrimonio';
            cuentaIdInput.value = '';
            modalTipoCuenta.value = 'cliente';
            toggleClienteField();
            
            // Resetear campos
            modalContrasena.placeholder = "Ingresar contraseña";
            modalContrasenaMail.placeholder = "Ingresar contraseña del mail";
            
            // Resetear checkboxes y valores por defecto
            modalVerificacion.checked = false;
            modalCeluAbierto.checked = false;
            modalAutentificador.checked = false;
            modalCodigosActualizados.value = '';
            modalCodigosValidez.value = 7;
        }
        showModal(patrimonioModalOverlay);
    };

    window.closePatrimonioModal = () => {
        hideModal(patrimonioModalOverlay);
    };

    // --- Lógica para Mostrar/Ocultar Contraseña en Tabla ---
    const tablasAuditoria = document.querySelectorAll('.auditoria-table tbody');
    tablasAuditoria.forEach(tbody => {
        tbody.addEventListener('click', (event) => {
            const icon = event.target.closest('.toggle-password-vis');
            if (!icon) return;
            
            const row = icon.closest('tr');
            const passwordDisplaySpan = row.querySelector('.password-display');
            if (!row || !passwordDisplaySpan || !row.dataset.cuenta) return;
            
            try {
                const cuentaData = JSON.parse(row.dataset.cuenta);
                const actualPassword = icon.classList.contains('fa-eye-slash') ? 
                    (cuentaData.contrasena || '(Vacía)') : '********';
                
                passwordDisplaySpan.textContent = actualPassword;
                passwordDisplaySpan.classList.toggle('visible', icon.classList.contains('fa-eye-slash'));
                icon.classList.toggle('fa-eye-slash', icon.classList.contains('fa-eye'));
                icon.classList.toggle('fa-eye', !icon.classList.contains('fa-eye'));
                icon.setAttribute('title', icon.classList.contains('fa-eye') ? 'Mostrar Contraseña' : 'Ocultar Contraseña');
            } catch (e) {
                console.error("Error procesando contraseña:", e);
            }
        });
    });

    // --- Listeners Generales ---
    // Cerrar modal al hacer clic fuera
    if (patrimonioModalOverlay) {
        patrimonioModalOverlay.addEventListener('click', (event) => {
            if (event.target === patrimonioModalOverlay) closePatrimonioModal();
        });
    }
    
    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape" && patrimonioModalOverlay?.classList.contains('modal-visible')) {
            closePatrimonioModal();
        }
    });

    // Configurar filtros para todas las tablas
    function setupTableFilters(tableId, filters) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        filters.forEach(filter => {
            const input = document.getElementById(filter.inputId);
            if (input) input.addEventListener('input', filterRows);
        });
        
        function filterRows() {
            rows.forEach(row => {
                let showRow = true;
                
                filters.forEach(filter => {
                    const input = document.getElementById(filter.inputId);
                    const cell = row.querySelector(filter.cellSelector);
                    
                    if (input && cell) {
                        const filterValue = input.value.toLowerCase();
                        
                        if (filter.inputId.includes('verificacion') || 
                            filter.inputId.includes('celu') || 
                            filter.inputId.includes('2fa')) {
                            // Para selects de estado
                            if (input.value !== '') {
                                const hasFeature = input.value === '1';
                                const cellHasFeature = cell.innerHTML.includes('text-success');
                                if (hasFeature !== cellHasFeature) showRow = false;
                            }
                        } else {
                            // Para inputs de texto
                            const cellValue = cell.textContent?.toLowerCase() || cell.innerHTML?.toLowerCase() || '';
                            if (filterValue && !cellValue.includes(filterValue)) showRow = false;
                        }
                    }
                });
                
                row.style.display = showRow ? '' : 'none';
            });
        }
    }

    // Configurar filtros para todas las tablas
    const tableConfigs = [
        { id: 'clientes-table', filters: [
            { inputId: 'filter-cliente-nombre', cellSelector: '.filter-cliente' },
            { inputId: 'filter-cliente-usuario', cellSelector: '.filter-usuario' },
            { inputId: 'filter-cliente-verificacion', cellSelector: '.filter-verificacion' },
            { inputId: 'filter-cliente-celu', cellSelector: '.filter-celu' },
            { inputId: 'filter-cliente-2fa', cellSelector: '.filter-2fa' }
        ]},
        { id: 'propios-table', filters: [
            { inputId: 'filter-propio-usuario', cellSelector: '.filter-usuario' },
            { inputId: 'filter-propio-verificacion', cellSelector: '.filter-verificacion' },
            { inputId: 'filter-propio-celu', cellSelector: '.filter-celu' },
            { inputId: 'filter-propio-2fa', cellSelector: '.filter-2fa' }
        ]},
        { id: 'demo-table', filters: [
            { inputId: 'filter-demo-usuario', cellSelector: '.filter-usuario' },
            { inputId: 'filter-demo-verificacion', cellSelector: '.filter-verificacion' },
            { inputId: 'filter-demo-celu', cellSelector: '.filter-celu' },
            { inputId: 'filter-demo-2fa', cellSelector: '.filter-2fa' }
        ]},
        { id: 'acrear-table', filters: [
            { inputId: 'filter-acrear-usuario', cellSelector: '.filter-usuario' },
            { inputId: 'filter-acrear-verificacion', cellSelector: '.filter-verificacion' },
            { inputId: 'filter-acrear-celu', cellSelector: '.filter-celu' },
            { inputId: 'filter-acrear-2fa', cellSelector: '.filter-2fa' }
        ]}
    ];

    tableConfigs.forEach(config => setupTableFilters(config.id, config.filters));
});