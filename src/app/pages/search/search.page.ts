import { Component, inject } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [IonicModule, ZXingScannerModule, CommonModule],
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss']
})
export class SearchPage {
  allowedFormats = [BarcodeFormat.QR_CODE];
  showQr = false;
  private router = inject(Router);

  onSearchChange(event: any) {
    // Lógica de búsqueda por texto
  }

  onCodeResult(result: string) {
    // Navegar al detalle del producto usando el ID escaneado
    if (result) {
      this.router.navigate(['/product', result]).then(() => {
        console.log('✅ Navegación exitosa a producto:', result);
      }).catch((error) => {
        console.error('❌ Error en navegación:', error);
      });
    }
  }
}
