// static/js/auditoria_manager.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias Modal Patrimonio ---
    const patrimonioModalOverlay = document.getElementById('patrimonioModalOverlay');
    const patrimonioForm = document.getElementById('patrimonio-form');
    const patrimonioModalLabel = document.getElementById('patrimonioModalLabel');
    const cuentaIdInput = document.getElementById('cuenta_id'); // ID oculto
    // Inputs del modal
    const modalTipoCuenta = document.getElementById('modal_tipo_cuenta');
    const modalClienteFieldGroup = document.getElementById('cliente-field-group');
    const modalNombreCliente = document.getElementById('modal_nombre_cliente');
    const modalUsuario = document.getElementById('modal_usuario');
    const modalCorreo = document.getElementById('modal_correo');
    const modalContrasena = document.getElementById('modal_contrasena');
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
        return; // Salir si no estamos en la página correcta
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
            if (firstInput) {
                 setTimeout(() => firstInput.focus(), 50); // Pequeño delay
            }
        }
    };
    const hideModal = (overlayElement) => {
        if (overlayElement) {
            overlayElement.classList.remove('modal-visible');
            setTimeout(() => {
                 if (!overlayElement.classList.contains('modal-visible')) {
                    overlayElement.style.display = 'none';
                 }
            }, 400); // Duración animación CSS
        }
    };

    window.openPatrimonioModal = (cuentaId = null) => {
        patrimonioForm.reset();
        patrimonioForm.classList.remove('was-validated'); // Reset validación Bootstrap si se usara

        if (cuentaId) { // MODO EDITAR
            const row = document.getElementById(`cuenta-row-${cuentaId}`);
            if (!row || !row.dataset.cuenta) { console.error("Datos de cuenta no encontrados:", cuentaId); alert("Error: No se pudieron cargar los datos."); return; }
            try {
                const data = JSON.parse(row.dataset.cuenta);
                patrimonioModalLabel.textContent = `Editar Cuenta: ${data.usuario}`;
                cuentaIdInput.value = data.id;

                modalTipoCuenta.value = data.tipo_cuenta || 'cliente';
                toggleClienteField(); // Actualizar visibilidad
                modalNombreCliente.value = data.nombre_cliente || '';
                modalUsuario.value = data.usuario || '';
                modalCorreo.value = data.correo || '';
                modalContrasena.placeholder = "Dejar vacío para no cambiar";
                modalLink.value = data.link || '';
                modalVerificacion.checked = data.verificacion || false;
                modalCeluAbierto.checked = data.celu_abierto || false;
                modalAutentificador.checked = data.autentificador || false;
                modalCodigosRespaldo.value = data.codigos_respaldo || '';
                modalCodigosActualizados.value = data.codigos_actualizados_en ? new Date(data.codigos_actualizados_en).toISOString().split('T')[0] : '';
                modalCodigosValidez.value = data.codigos_validez_dias || 7;

            } catch (e) { console.error("Error parseando datos de cuenta:", e); alert("Error al cargar datos para editar."); return; }
        } else { // MODO AGREGAR
            patrimonioModalLabel.textContent = 'Agregar Cuenta a Patrimonio';
            cuentaIdInput.value = '';
            modalTipoCuenta.value = 'cliente';
            toggleClienteField();
            modalContrasena.placeholder = "Ingresar contraseña";
            // Asegurar que checkboxes estén desmarcados y fecha/validez en default
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
                const actualPassword = cuentaData.contrasena;
                if (icon.classList.contains('fa-eye')) {
                    passwordDisplaySpan.textContent = actualPassword || '(Vacía)';
                    passwordDisplaySpan.classList.add('visible');
                    icon.classList.replace('fa-eye', 'fa-eye-slash');
                    icon.setAttribute('title', 'Ocultar Contraseña');
                } else {
                    passwordDisplaySpan.textContent = '********';
                    passwordDisplaySpan.classList.remove('visible');
                    icon.classList.replace('fa-eye-slash', 'fa-eye');
                    icon.setAttribute('title', 'Mostrar Contraseña');
                }
            } catch (e) { console.error("Error procesando contraseña:", e); }
        });
    });


    // --- Listeners Generales ---
    // Cerrar modal al hacer clic fuera
    if (patrimonioModalOverlay) {
        patrimonioModalOverlay.addEventListener('click', (event) => {
            if (event.target === patrimonioModalOverlay) { closePatrimonioModal(); }
        });
    }
    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (event) => {
         if (event.key === "Escape") {
             if (patrimonioModalOverlay?.classList.contains('modal-visible')) {
                 closePatrimonioModal();
             }
             // Podrías añadir lógica para cerrar OTROS modales aquí si combinas JS
             // else if (vendedorModalOverlay?.classList.contains('modal-visible')) { closeVendedorModal(); }
             // else if (desempenoModalOverlay?.classList.contains('modal-visible')) { closeDesempenoModal(); }
         }
     });

}); // Fin DOMContentLoaded