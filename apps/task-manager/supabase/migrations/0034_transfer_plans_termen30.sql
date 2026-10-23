-- Al treilea temei de transfer: „30 zile", în baza unei încheieri.
--
-- Transferul se face la prima zi programată, ca la decizie, dar cu un termen:
-- 30 de zile de la ziua în care încheierea a fost introdusă în modul. Dacă omul
-- nu pleacă până atunci, rândul se semnalează „termen depășit".
--
-- Două date, cu rosturi diferite:
--
-- `ruling_date` — data încheierii, cum e scrisă pe ea. O completează omul.
--
-- `term_start` — ziua de la care curg cele 30 de zile: ziua introducerii în
-- modul, cum s-a cerut. O pune aplicația, nu omul, și n-o mai mută la editările
-- de după — altfel o corectură de virgulă în observații ar fi repornit termenul
-- de la zero. Nu e `created_at`: o însemnare făcută pe alt temei și trecută
-- abia mai târziu pe „30 zile" și-ar fi văzut termenul pornit din trecut.
--
-- Termenul-limită nu se scrie în bază; se socotește din `term_start`, ca ziua
-- de transfer — o coloană în plus ar trebui ținută la zi cu mâna.

alter table transfer_plans
  add column if not exists ruling_date date,
  add column if not exists term_start date;

alter table transfer_plans drop constraint if exists transfer_plans_basis_check;
alter table transfer_plans add constraint transfer_plans_basis_check
  check (basis in ('sedinta', 'decizie', 'termen30'));

-- Aceeași regulă întreagă ca în 0027, cu ramura nouă. O singură constrângere,
-- ca o planificare pe jumătate completată să nu încapă deloc în tabel.
-- Instanța e obligatorie la „30 zile", ca la ședință — așa s-a cerut.
alter table transfer_plans drop constraint if exists transfer_plans_temei;
alter table transfer_plans add constraint transfer_plans_temei check (
  (
    basis = 'sedinta'
    and hearing_date is not null
    and decision_date is null
    and ruling_date is null
    and court is not null
  )
  or (
    basis = 'decizie'
    and decision_date is not null
    and hearing_date is null
    and ruling_date is null
  )
  or (
    basis = 'termen30'
    and ruling_date is not null
    and term_start is not null
    and hearing_date is null
    and decision_date is null
    and court is not null
  )
);

-- O încheiere nu poate data de după ziua în care a fost introdusă: ar fi o
-- hârtie din viitor, adică aproape sigur o dată greșit tastată.
alter table transfer_plans drop constraint if exists transfer_plans_ruling_before_start;
alter table transfer_plans add constraint transfer_plans_ruling_before_start
  check (ruling_date is null or term_start is null or ruling_date <= term_start);
