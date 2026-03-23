import { Component } from '@angular/core';
import { Sidebar } from '../../../../shared/components/sidebar/sidebar';
import { Navbar } from '../../../../shared/components/navbar/navbar';
import { RouterOutlet } from '@angular/router';
import { Footer } from '../../../../shared/components/footer/footer';

@Component({
    selector: 'app-layout',
    templateUrl: './layout.html',
    styleUrl: './layout.css',
    imports: [
        Sidebar,
        Navbar,
        RouterOutlet,
        Footer,
    ],
    
})
export class Layout {

}
