import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss']
})
export class ResetPasswordPage implements OnInit {
  resetPasswordForm: FormGroup;
  submitting = false;
  showPassword = false;
  showConfirmPassword = false;
  token = '';
  expires = 0;
  signature = '';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastController = inject(ToastController);

  constructor() {
    this.resetPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
      token: ['']
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Obtener TODOS los parámetros de los query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      const email = params['email'] || '';
      const expires = params['expires'] || '';
      const signature = params['signature'] || '';
      
      // Validar que TODOS los parámetros existan
      if (!this.token || !email || !expires || !signature) {
        this.showErrorToast('Enlace de recuperación inválido. Faltan parámetros.');
        this.router.navigate(['/forgot-password']);
        return;
      }

      // Validar que no haya expirado (opcional, el backend también lo valida)
      const expiresTimestamp = parseInt(expires);
      const now = Math.floor(Date.now() / 1000);
      
      if (expiresTimestamp < now) {
        this.showErrorToast('Este enlace de recuperación ha expirado. Solicita uno nuevo.');
        this.router.navigate(['/forgot-password']);
        return;
      }

      // Actualizar el formulario
      this.resetPasswordForm.patchValue({
        email: email,
        token: this.token
      });

      // Guardar expires y signature para el POST
      this.expires = expiresTimestamp;
      this.signature = signature;

      console.log('Parámetros extraídos correctamente:', {
        email,
        hasToken: !!this.token,
        expires: this.expires,
        hasSignature: !!this.signature
      });
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('password_confirmation');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return field ? field.valid && field.touched : false;
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.resetPasswordForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.resetPasswordForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('email')) {
      return 'Por favor ingresa un correo válido';
    }
    if (field?.hasError('minlength')) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (field?.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }
    return '';
  }

  async onSubmit() {
    if (this.resetPasswordForm.invalid || this.submitting) {
      return;
    }

    this.submitting = true;
    
    // Construir el objeto con TODOS los datos requeridos
    const resetData = {
      email: this.resetPasswordForm.value.email,
      password: this.resetPasswordForm.value.password,
      password_confirmation: this.resetPasswordForm.value.password_confirmation,
      token: this.resetPasswordForm.value.token,
      expires: this.expires,
      signature: this.signature
    };

    console.log('📤 Enviando reset password con datos:', {
      email: resetData.email,
      hasPassword: !!resetData.password,
      hasConfirmation: !!resetData.password_confirmation,
      token: resetData.token.substring(0, 20) + '...',
      expires: resetData.expires,
      expiresType: typeof resetData.expires,
      signature: resetData.signature.substring(0, 20) + '...'
    });

    this.authService.resetPassword(resetData).subscribe({
      next: async (response) => {
        this.submitting = false;
        console.log('✅ Reset password response:', response);
        
        const toast = await this.toastController.create({
          message: response.message || 'Contraseña restablecida exitosamente',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        setTimeout(() => {
          this.router.navigate(['/tabs/login']);
        }, 1000);
      },
      error: async (error) => {
        this.submitting = false;
        console.error('❌ Reset password error completo:', error);
        
        let message = 'Error al restablecer la contraseña.';
        
        if (error.error?.message) {
          message = error.error.message;
        } else if (error.status === 403) {
          message = 'El enlace es inválido o ha expirado. Solicita uno nuevo.';
        } else if (error.status === 422) {
          const errors = error.error?.errors;
          if (errors) {
            message = Object.values(errors).flat().join(', ');
          } else {
            message = 'Error de validación. Verifica los datos ingresados.';
          }
        }
        
        await this.showErrorToast(message);
      }
    });
  }

  async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }

  goToLogin() {
    this.router.navigate(['/tabs/login']);
  }
}
