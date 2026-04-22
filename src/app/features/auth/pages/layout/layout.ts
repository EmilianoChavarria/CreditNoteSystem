import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';

@Component({
    selector: 'app-layout',
    templateUrl: './layout.html',
    styleUrl: './layout.css',
    imports: [RouterOutlet, Navbar, Footer],
})
export class Layout {

}
