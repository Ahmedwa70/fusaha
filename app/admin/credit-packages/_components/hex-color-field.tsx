"use client";

import Color from "color";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";

const FALLBACK_SWATCH = "#94a3b8";

// Pairs the shadcn color-picker (for visual selection) with a plain text
// input (so the admin can also paste/type an exact hex value). Both write
// the same string field — see validation/credit-packages.ts's optionalHexColor.
export function HexColorField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : FALLBACK_SWATCH;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={id}
              className="size-9 shrink-0 p-1"
            >
              <span className="size-full rounded-sm border border-border" style={{ backgroundColor: swatch }} />
            </Button>
          }
        />
        <PopoverContent className="w-72">
          <ColorPicker
            value={swatch}
            onChange={(rgba) => {
              const [r, g, b] = rgba as [number, number, number, number];
              onChange(Color.rgb(r, g, b).hex());
            }}
          >
            <ColorPickerSelection className="h-40" />
            <ColorPickerHue />
            <ColorPickerAlpha />
            <div className="flex items-center gap-2">
              <ColorPickerEyeDropper />
              <ColorPickerOutput />
              <ColorPickerFormat />
            </div>
          </ColorPicker>
        </PopoverContent>
      </Popover>
      <Input id={id} dir="ltr" placeholder="#RRGGBB" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
