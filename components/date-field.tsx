"use client";

import { useState } from "react";
import { ptBR } from "react-day-picker/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n: number) => String(n).padStart(2, "0");
// meio-dia local: "2026-11-29" nunca vira o dia anterior por causa do fuso
const toDate = (iso: string) => (iso ? new Date(`${iso}T12:00:00`) : undefined);
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const display = (iso: string) => new Intl.DateTimeFormat("pt-BR").format(toDate(iso));

/**
 * Campo de data em português (dd/mm/aaaa e calendário com semana a partir do domingo e meses em
 * pt-BR), no lugar do `<input type="date">`, que segue o idioma do navegador. O valor é sempre
 * "AAAA-MM-DD" ou "" (sem data); com `name`, vai num input escondido para os formulários.
 */
export function DateField({
  id,
  label,
  name,
  value,
  defaultValue = "",
  onChange,
  placeholder = "Sem data",
  invalid,
  className,
}: {
  id: string;
  /** Nome do campo para o leitor de tela ("Prazo"); o botão anuncia "Prazo: 29/11/2026". */
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? own;

  function pick(iso: string) {
    if (value === undefined) setOwn(iso);
    onChange?.(iso);
    setOpen(false);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={`${label}: ${current ? display(current) : placeholder}`}
            aria-invalid={invalid}
            className={cn("min-w-36 flex-1 justify-start font-normal", !current && "text-muted-foreground")}
          >
            <CalendarIcon aria-hidden="true" />
            {current ? display(current) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          // o foco vai para o dia escolhido (ou hoje), não para a seta de mês anterior, que é o
          // primeiro botão do popover: assim as setas do teclado andam pelos dias e Enter escolhe
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const root = e.currentTarget as HTMLElement;
            // um seletor de cada vez: uma lista única devolveria o primeiro na ordem da página
            const day = ['[data-selected="true"] button', '[data-today="true"] button', "td button"]
              .map((s) => root.querySelector<HTMLElement>(s))
              .find(Boolean);
            day?.focus();
          }}
        >
          <Calendar
            mode="single"
            locale={ptBR}
            selected={toDate(current)}
            defaultMonth={toDate(current)}
            onSelect={(d) => d && pick(toIso(d))}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {current && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remover ${label.toLocaleLowerCase("pt-BR")}`}
          title="Remover data"
          onClick={() => pick("")}
        >
          <X aria-hidden="true" />
        </Button>
      )}
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
