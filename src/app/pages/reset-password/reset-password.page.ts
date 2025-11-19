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
    // Obtener token y email de los query params
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      const email = params['email'] || '';
      
      if (!this.token || !email) {
        this.showErrorToast('Enlace de recuperación inválido o expirado');
        this.router.navigate(['/forgot-password']);
        return;
      }

      this.resetPasswordForm.patchValue({
        email: email,
        token: this.token
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

    this.authService.resetPassword(this.resetPasswordForm.value).subscribe({
      next: async (response) => {
        this.submitting = false;
        
        const toast = await this.toastController.create({
          message: response.message || 'Contraseña restablecida exitosamente',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // Redirigir al login después de 1 segundo
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1000);
      },
      error: async (error) => {
        this.submitting = false;
        
        const message = error.error?.message || 'Error al restablecer la contraseña. El enlace puede haber expirado.';
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
}
