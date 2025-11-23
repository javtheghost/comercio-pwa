import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'currency',
    standalone: true
})
export class CurrencyPipe implements PipeTransform {
    transform(value: string | number, currencySymbol: string = '$', decimals: number = 2, locale: string = 'es-MX'): string {
        if (value === null || value === undefined || value === '') {
            return `${currencySymbol}0.00`;
        }

        // Convertir a número
        const numValue = typeof value === 'string' ? parseFloat(value) : value;

        if (isNaN(numValue)) {
            return `${currencySymbol}0.00`;
        }

        // Formatear con separadores de miles y decimales
        const formatted = numValue.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        return `${currencySymbol}${formatted}`;
    }
}
