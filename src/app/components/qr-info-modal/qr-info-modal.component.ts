import { Component, Input, Output, EventEmitter, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-qr-info-modal',
  standalone: true,
  template: `
    <div class="qr-modal-backdrop" (click)="close()" tabindex="-1"></div>
    <div class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title" aria-describedby="qr-modal-desc" tabindex="0">
      <h2 id="qr-modal-title">¿Cómo escanear productos?</h2>
      <h3 id="qr-modal-sub">Escaneo de código QR</h3>
      <p id="qr-modal-desc">
        Pulsa el ícono de QR junto al buscador y apunta la cámara al código QR del producto. Así podrás encontrarlo rápidamente sin escribir. ¡Ideal para tiendas físicas o catálogos impresos!
      </p>
      <button class="qr-modal-btn" (click)="close()" #acceptBtn>Aceptar</button>
    </div>
  `,
  styleUrls: ['./qr-info-modal.component.scss']
})
export class QrInfoModalComponent implements AfterViewInit {
  @Input() isOpen = false;
  @Output() didDismiss = new EventEmitter<void>();

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    // Mueve el foco al botón aceptar cuando se abre
    setTimeout(() => {
      const btn = this.el.nativeElement.querySelector('.qr-modal-btn') as HTMLElement;
      if (btn) btn.focus();
    }, 50);
  }

  close() {
    this.didDismiss.emit();
  }
}
