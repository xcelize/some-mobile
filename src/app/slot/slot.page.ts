import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {IonButton, IonContent, IonHeader, IonInput, IonTitle, IonToolbar} from '@ionic/angular/standalone';
import {ActivatedRoute, Router} from "@angular/router";
import {PageHeaderComponent} from "../page-header/page-header.component";

@Component({
  selector: 'app-slot',
  templateUrl: './slot.page.html',
  styleUrls: ['./slot.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonButton, IonInput, PageHeaderComponent]
})
export class SlotPage {

  mode: 'create' | 'edit' = 'create';
  dayOfWeek = 1;
  index: number | null = null;

  slotForm = {
    start: '00:00',
    temperature: 20,
  };

  dayLabels: Record<number, string> = {
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',
    0: 'Dimanche',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ionViewWillEnter(): void {

    const query = history.state?.slotFormData;


    this.mode = (query?.mode as 'create' | 'edit') || 'create';
    this.dayOfWeek = Number(query?.dayOfWeek ?? 1);

    const rawIndex = query?.index;
    this.index = rawIndex !== null ? Number(rawIndex) : null;

    this.slotForm = {
      start: this.formatHour(query?.slot?.start) ?? '00:00',
      temperature: Number(query?.slot?.temperature ?? 20),
    };
  }

  get pageTitle(): string {
    return this.mode === 'create' ? 'Ajouter un créneau' : 'Modifier le créneau';
  }

  get dayLabel(): string {
    return this.dayLabels[this.dayOfWeek] ?? 'Jour';
  }

  formatHour(time: string): string {
    if (!time) return '00:00';
    const [h = '0', m = '0'] = time.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  save(): void {
    const payload = {
      mode: this.mode,
      dayOfWeek: this.dayOfWeek,
      index: this.index,
      slot: {
        start: this.formatHour(this.slotForm.start),
        temperature: Number(this.slotForm.temperature),
      },
    };

    this.router.navigate(['/tabs/tab2'], {
      state: { slotPayload: payload },
    });
  }

  cancel(): void {
    this.router.navigate(['/tabs/tab2']);
  }

}
