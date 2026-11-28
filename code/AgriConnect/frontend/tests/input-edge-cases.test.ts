import { describe, expect, it } from 'vitest';
import { matchCropCategory } from '../src/lib/crop-categories';

describe('Crop Category Auto-Selection Input Edge Cases', () => {
  describe('Falsy and empty input boundaries', () => {
    it('returns null for null, undefined, and empty/whitespace strings', () => {
      expect(matchCropCategory(null)).toBeNull();
      expect(matchCropCategory(undefined)).toBeNull();
      expect(matchCropCategory('')).toBeNull();
      expect(matchCropCategory('   ')).toBeNull();
      expect(matchCropCategory('\t\n')).toBeNull();
    });

    it('returns null for non-crop special characters and numbers', () => {
      expect(matchCropCategory('###')).toBeNull();
      expect(matchCropCategory('12345')).toBeNull();
      expect(matchCropCategory('!@#$%^&*()')).toBeNull();
      expect(matchCropCategory('<script>alert(1)</script>')).toBeNull();
    });
  });

  describe('Case-insensitivity and casing edge cases', () => {
    it('matches regardless of upper, lower, or mixed casing', () => {
      expect(matchCropCategory('WHEAT')).toBe('grains');
      expect(matchCropCategory('WhEaT')).toBe('grains');
      expect(matchCropCategory('wheat')).toBe('grains');
      expect(matchCropCategory('TURMERIC')).toBe('spices');
      expect(matchCropCategory('TuRmErIc')).toBe('spices');
      expect(matchCropCategory('JEERA')).toBe('spices');
      expect(matchCropCategory('mOoNg')).toBe('pulses');
    });
  });

  describe('Punctuation and compound input edge cases', () => {
    it('matches crop names with surrounding punctuation or brackets', () => {
      expect(matchCropCategory('wheat,')).toBe('grains');
      expect(matchCropCategory('wheat (PBW-343)')).toBe('grains');
      expect(matchCropCategory('organic-wheat')).toBe('grains');
      expect(matchCropCategory('fresh tomatoes!')).toBe('vegetables');
      expect(matchCropCategory('pure haldi, 50kg')).toBe('spices');
      expect(matchCropCategory('red chilli / mirch')).toBe('spices');
      expect(matchCropCategory('sweet-corn')).toBe('grains');
    });

    it('matches multi-word crops and category names', () => {
      expect(matchCropCategory('pearl millet')).toBe('grains');
      expect(matchCropCategory('black pepper')).toBe('spices');
      expect(matchCropCategory('green gram')).toBe('pulses');
      expect(matchCropCategory('bitter gourd')).toBe('vegetables');
      expect(matchCropCategory('finger millet')).toBe('grains');
      expect(matchCropCategory('spices')).toBe('spices');
      expect(matchCropCategory('grains')).toBe('grains');
      expect(matchCropCategory('vegetables')).toBe('vegetables');
    });
  });

  describe('Vernacular and transliterated Hindi terms', () => {
    it('matches everyday Indian agricultural terminology', () => {
      expect(matchCropCategory('gehu')).toBe('grains');
      expect(matchCropCategory('chawal')).toBe('grains');
      expect(matchCropCategory('makka')).toBe('grains');
      expect(matchCropCategory('haldi')).toBe('spices');
      expect(matchCropCategory('jeera')).toBe('spices');
      expect(matchCropCategory('dhaniya')).toBe('spices');
      expect(matchCropCategory('elaichi')).toBe('spices');
      expect(matchCropCategory('aloo')).toBe('vegetables');
      expect(matchCropCategory('pyaz')).toBe('vegetables');
      expect(matchCropCategory('tamatar')).toBe('vegetables');
      expect(matchCropCategory('sarson')).toBe('oilseeds');
      expect(matchCropCategory('moongfali')).toBe('oilseeds');
      expect(matchCropCategory('chana')).toBe('pulses');
      expect(matchCropCategory('moong')).toBe('pulses');
      expect(matchCropCategory('aam')).toBe('fruits');
      expect(matchCropCategory('seb')).toBe('fruits');
    });
  });

  describe('False positive isolation (Word-boundary safety)', () => {
    it('prevents false substring matches on unrelated English words', () => {
      // "hotel" contains "tel" (oilseeds)
      expect(matchCropCategory('hotel')).toBeNull();
      // "aluminum" contains "alu" (vegetables)
      expect(matchCropCategory('aluminum')).toBeNull();
      // "saturday" contains "tur" (pulses)
      expect(matchCropCategory('saturday')).toBeNull();
      // "stream" contains "tea" (other)
      expect(matchCropCategory('stream')).toBeNull();
      // "team" contains "tea" (other)
      expect(matchCropCategory('team')).toBeNull();
      // "sandalwood" contains "dal" (pulses)
      expect(matchCropCategory('sandalwood')).toBeNull();
      // "metal" contains "tel"
      expect(matchCropCategory('metal')).toBeNull();
      // "bullet" contains "u"
      expect(matchCropCategory('bullet')).toBeNull();
    });

    it('rejects general non-agricultural commodities and machinery', () => {
      expect(matchCropCategory('tractor')).toBeNull();
      expect(matchCropCategory('fertilizer')).toBeNull();
      expect(matchCropCategory('pesticide')).toBeNull();
      expect(matchCropCategory('diesel pump')).toBeNull();
      expect(matchCropCategory('drone sprayer')).toBeNull();
    });
  });
});
