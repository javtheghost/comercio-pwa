import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-order-confirmation',
  templateUrl: './order-confirmation.page.html',
  styleUrls: ['./order-confirmation.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class OrderConfirmationPage implements OnInit {
  orderId: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.orderId = this.route.snapshot.queryParams['orderId'] || '12345';
  }

  goToHome(): void {
    this.router.navigate(['/tabs/home']);
  }

  goToOrders(): void {
    this.router.navigate(['/tabs/orders']);
  }
}


