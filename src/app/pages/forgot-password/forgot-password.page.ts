import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss']
})
export class ForgotPasswordPage {
  forgotPasswordForm: FormGroup;
  submitting = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastController = inject(ToastController);

  constructor() {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return field ? field.valid && field.touched : false;
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.forgotPasswordForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.forgotPasswordForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('email')) {
      return 'Por favor ingresa un correo válido';
    }
    return '';
  }

  async onSubmit() {
    if (this.forgotPasswordForm.invalid || this.submitting) {
      return;
    }

    this.submitting = true;

    this.authService.forgotPassword(this.forgotPasswordForm.value).subscribe({
      next: async (response) => {
        this.submitting = false;
        console.log('✅ Forgot password response:', response);
        
        const toast = await this.toastController.create({
          message: response.message || 'Se ha enviado un correo con instrucciones para restablecer tu contraseña',
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        await toast.present();

        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/tabs/login']);
        }, 2000);
      },
      error: async (error) => {
        this.submitting = false;
        console.error('❌ Forgot password error:', error);
        
        const toast = await this.toastController.create({
          message: error.error?.message || error.message || 'Error al enviar el correo de recuperación',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }
}
