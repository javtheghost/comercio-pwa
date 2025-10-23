import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon, IonTextarea, IonSelect, IonSelectOption, IonRadioGroup, IonRadio, IonButtons, IonBackButton, IonText, IonList, ToastController } from '@ionic/angular/standalone';
import { AddressService } from '../../services/address.service';
import { Address } from '../../interfaces/address.interfaces';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon, IonTextarea, IonSelect, IonSelectOption, IonRadioGroup, IonRadio, IonButtons, IonBackButton, IonText, IonList],
  templateUrl: './address.page.html',
  styleUrls: ['./address.page.scss']
})
export class AddressPage implements OnInit {
  address: Partial<Address> = {
    type: 'shipping', // Solo direcciones de envío
    first_name: '',
    last_name: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'México',
    phone: '',
    is_default: false
  };

  isEditing = false;
  addressId: number | null = null;
  loading = false;
  saving = false;

  // Para autocompletado de direcciones
  addressSuggestions: any[] = [];
  showSuggestions = false;
  searchTimeout: any = null;

  constructor(
    private addressService: AddressService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.addressId = +params['id'];
        this.isEditing = true;
        this.loadAddress();
      }
    });
  }

  async loadAddress(): Promise<void> {
    if (!this.addressId) return;

    this.loading = true;
    try {
      const response = await firstValueFrom(this.addressService.getAddress(this.addressId));
      if (response && response.success && !Array.isArray(response.data)) {
        this.address = response.data;
      }
    } catch (error: any) {
      console.error('Error cargando dirección:', error);
    } finally {
      this.loading = false;
    }
  }

  async saveAddress(): Promise<void> {
    if (!this.isFormValid()) {
      console.log('Formulario no válido:', this.address);
      return;
    }

    console.log('Datos a enviar:', this.address);
    this.saving = true;

    try {
      if (this.isEditing && this.addressId) {
        // Actualizar dirección existente
        const addressData = {
          id: this.addressId,
          ...this.address
        };
        console.log('Actualizando dirección:', addressData);

        const response = await firstValueFrom(this.addressService.updateAddress(addressData));

        if (response && response.success) {
          // Mostrar toast de éxito
          const toast = await this.toastController.create({
            message: 'Dirección actualizada exitosamente',
            duration: 3000,
            color: 'success',
            position: 'top'
          });
          await toast.present();

          this.router.navigate(['/tabs/profile']);
        }
      } else {
        // Crear nueva dirección
        console.log('Creando nueva dirección:', this.address);
        const response = await firstValueFrom(this.addressService.createAddress(this.address as any));

        if (response && response.success) {
          // Mostrar toast de éxito
          const toast = await this.toastController.create({
            message: '¡Dirección creada exitosamente!',
            duration: 3000,
            color: 'success',
            position: 'top'
          });
          await toast.present();

          this.router.navigate(['/tabs/profile']);
        }
      }
    } catch (error: any) {
      console.error('Error guardando dirección:', error);
      console.error('Error details:', error.error);

      // Mostrar toast de error
      const toast = await this.toastController.create({
        message: 'Error al guardar la dirección. Por favor intenta nuevamente.',
        duration: 4000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    } finally {
      this.saving = false;
    }
  }

  isFormValid(): boolean {
    // Validación básica de campos requeridos
    const hasRequiredFields = !!(
      this.address.first_name?.trim() &&
      this.address.last_name?.trim() &&
      this.address.address_line_1?.trim() &&
      this.address.city?.trim() &&
      this.address.state?.trim() &&
      this.address.postal_code?.trim() &&
      this.address.country?.trim() &&
      this.address.phone?.trim()
    );

    if (!hasRequiredFields) {
      return false;
    }

    // Validación de formatos usando el servicio
    const validation = this.addressService.validateAddressData(this.address);
    return validation.isValid;
  }

  goBack(): void {
    this.router.navigate(['/tabs/profile']);
  }

  getFieldError(fieldName: string): string | null {
    const validation = this.addressService.validateAddressData(this.address);
    const fieldErrors: { [key: string]: string } = {
      'first_name': 'El nombre es requerido',
      'last_name': 'El apellido es requerido',
      'address_line_1': 'La dirección es requerida',
      'city': 'La ciudad es requerida',
      'state': 'El estado es requerido',
      'postal_code': 'El código postal es requerido',
      'country': 'El país es requerido',
      'phone': 'El teléfono es requerido'
    };

    // Si el campo está vacío, mostrar error básico
    const fieldValue = this.address[fieldName as keyof typeof this.address];
    if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
      return fieldErrors[fieldName] || null;
    }

    // Si hay errores de validación, buscar el específico del campo
    if (!validation.isValid) {
      const fieldSpecificErrors = validation.errors.filter(error =>
        error.toLowerCase().includes(fieldName.replace('_', ' ')) ||
        (fieldName === 'first_name' && error.includes('nombre')) ||
        (fieldName === 'last_name' && error.includes('apellido')) ||
        (fieldName === 'address_line_1' && error.includes('dirección')) ||
        (fieldName === 'city' && error.includes('ciudad')) ||
        (fieldName === 'state' && error.includes('estado')) ||
        (fieldName === 'postal_code' && error.includes('código postal')) ||
        (fieldName === 'country' && error.includes('país')) ||
        (fieldName === 'phone' && error.includes('teléfono'))
      );

      return fieldSpecificErrors.length > 0 ? fieldSpecificErrors[0] : null;
    }

    return null;
  }

  hasValidationErrors(): boolean {
    const validation = this.addressService.validateAddressData(this.address);
    return !validation.isValid && validation.errors.length > 0;
  }

  getValidationErrors(): string[] {
    const validation = this.addressService.validateAddressData(this.address);
    return validation.errors;
  }

  /**
   * Buscar sugerencias de direcciones
   */
  async searchAddressSuggestions(query: string): Promise<void> {
    if (!query || query.length < 3) {
      this.addressSuggestions = [];
      this.showSuggestions = false;
      return;
    }

    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Debounce: esperar 500ms antes de buscar
    this.searchTimeout = setTimeout(async () => {
      try {
        this.addressSuggestions = await this.addressService.getAddressSuggestions(query);
        this.showSuggestions = this.addressSuggestions.length > 0;
        console.log('📍 Sugerencias encontradas:', this.addressSuggestions);
      } catch (error) {
        console.error('Error buscando sugerencias:', error);
        this.addressSuggestions = [];
        this.showSuggestions = false;
      }
    }, 500);
  }

  /**
   * Seleccionar una sugerencia de dirección
   */
  selectAddressSuggestion(suggestion: any): void {
    console.log('📍 Dirección seleccionada:', suggestion);

    // Rellenar campos automáticamente
    this.address.address_line_1 = suggestion.address.address_line_1;
    this.address.city = suggestion.address.city;
    this.address.state = suggestion.address.state;
    this.address.postal_code = suggestion.address.postal_code;
    this.address.country = suggestion.address.country;

    // Ocultar sugerencias
    this.showSuggestions = false;
    this.addressSuggestions = [];
  }

  /**
   * Ocultar sugerencias
   */
  hideSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  debugForm(): void {
    console.log('=== DEBUG FORMULARIO ===');
    console.log('address object:', this.address);
    console.log('isFormValid():', this.isFormValid());
    console.log('Campos individuales:');
    console.log('- first_name:', this.address.first_name);
    console.log('- last_name:', this.address.last_name);
    console.log('- address_line_1:', this.address.address_line_1);
    console.log('- address_line_2:', this.address.address_line_2);
    console.log('- city:', this.address.city);
    console.log('- state:', this.address.state);
    console.log('- postal_code:', this.address.postal_code, '(tipo:', typeof this.address.postal_code, ')');
    console.log('- country:', this.address.country);
    console.log('- phone:', this.address.phone);
    console.log('- type:', this.address.type);
    console.log('- is_default:', this.address.is_default);
    console.log('========================');
  }
}
