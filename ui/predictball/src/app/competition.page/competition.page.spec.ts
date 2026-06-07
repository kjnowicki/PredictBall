import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitionPage } from './competition.page';

describe('CompetitionPage', () => {
  let component: CompetitionPage;
  let fixture: ComponentFixture<CompetitionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetitionPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompetitionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
