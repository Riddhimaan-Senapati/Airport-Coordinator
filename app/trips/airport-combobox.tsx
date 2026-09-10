"use client";

import { useEffect, useId, useRef, useState } from "react";

export type AirportOption = {
  id: number;
  code: string;
  name: string;
  municipality: string | null;
  countryCode: string;
};

type AirportSearchResponse = { airports: AirportOption[] };

const SEARCH_DELAY_MS = 200;

function airportLabel(airport: AirportOption) {
  const place = [airport.municipality, airport.countryCode].filter(Boolean).join(", ");
  return `${airport.code} - ${airport.name}${place ? `, ${place}` : ""}`;
}

export function AirportCombobox({ initialAirport }: { initialAirport: AirportOption | undefined }) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialAirport ? airportLabel(initialAirport) : "");
  const [selectedAirport, setSelectedAirport] = useState<AirportOption | undefined>(initialAirport);
  const [results, setResults] = useState<AirportOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeAirport = results[activeIndex];

  useEffect(() => {
    if (!open || selectedAirport || !query.trim()) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/airports?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Airport search failed.");
        const data: AirportSearchResponse = await response.json();
        setResults(data.airports.slice(0, 10));
        setActiveIndex(0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, selectedAirport]);

  function selectAirport(airport: AirportOption) {
    setSelectedAirport(airport);
    setQuery(airportLabel(airport));
    setResults([]);
    setOpen(false);
    inputRef.current?.setCustomValidity("");
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (results.length === 0) return;
    setOpen(true);
    setActiveIndex((current) => (current + direction + results.length) % results.length);
  }

  return (
    <div
      className="relative"
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="mb-2 block text-sm font-medium" htmlFor={inputId}>
        Airport
      </label>
      <input name="airportId" type="hidden" value={selectedAirport?.id ?? ""} />
      <input
        aria-activedescendant={
          open && activeAirport ? `${listboxId}-${activeAirport.id}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        autoComplete="off"
        className="field"
        id={inputId}
        maxLength={100}
        onChange={(event) => {
          const nextQuery = event.currentTarget.value;
          setQuery(nextQuery);
          setSelectedAirport(undefined);
          if (!nextQuery.trim()) {
            setResults([]);
            setLoading(false);
          }
          setActiveIndex(0);
          setOpen(true);
          event.currentTarget.setCustomValidity("Choose an airport from the suggestions.");
        }}
        onFocus={() => {
          if (!selectedAirport) setOpen(true);
        }}
        onInvalid={(event) => {
          if (!selectedAirport) {
            event.currentTarget.setCustomValidity("Choose an airport from the suggestions.");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveActiveIndex(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveActiveIndex(-1);
          } else if (event.key === "Enter" && open && activeAirport) {
            event.preventDefault();
            selectAirport(activeAirport);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search by airport, city, IATA, ICAO, or local code"
        ref={inputRef}
        required
        role="combobox"
        value={query}
      />
      {open && query.trim() ? (
        <ul
          className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-white p-1 shadow-lg"
          id={listboxId}
          role={
            /* oxlint-disable-line jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */ "listbox"
          }
        >
          {results.map((airport, index) => {
            const isActive = index === activeIndex;
            return (
              /* oxlint-disable-next-line jsx-a11y/click-events-have-key-events */
              <li
                aria-selected={isActive}
                className={`cursor-pointer rounded px-3 py-2 ${isActive ? "bg-secondary" : ""}`}
                id={`${listboxId}-${airport.id}`}
                key={airport.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAirport(airport)}
                role={
                  /* oxlint-disable-line jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */ "option"
                }
              >
                <span className="font-medium">{airport.code}</span>
                <span> · {airport.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {[airport.municipality, airport.countryCode].filter(Boolean).join(", ")}
                </span>
              </li>
            );
          })}
          {loading ? (
            <li
              aria-disabled
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
              role={
                /* oxlint-disable-line jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */ "option"
              }
            >
              Searching airports...
            </li>
          ) : null}
          {!loading && results.length === 0 ? (
            <li
              aria-disabled
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
              role={
                /* oxlint-disable-line jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */ "option"
              }
            >
              No airports found. Try a city, airport name, or code.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
