import { AfterContentInit, Component, ContentChild, Input } from '@angular/core';
import { HeaderSubtitleDirective } from './header-subtitle.directive';
import { HeaderActionsDirective } from './header-actions.directive';
import {CommonModule} from "@angular/common";

@Component({
  selector: 'page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  imports: [CommonModule]
})
export class PageHeaderComponent implements AfterContentInit {
  @Input() title = '';
  @Input() subtitle = '';

  @ContentChild(HeaderSubtitleDirective) subtitleContent?: HeaderSubtitleDirective;
  @ContentChild(HeaderActionsDirective) actionsContent?: HeaderActionsDirective;

  hasProjectedSubtitle = false;
  hasProjectedActions = false;

  ngAfterContentInit(): void {
    this.hasProjectedSubtitle = !!this.subtitleContent;
    this.hasProjectedActions = !!this.actionsContent;
  }
}
