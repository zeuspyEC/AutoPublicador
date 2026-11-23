import { describe, expect, it } from 'vitest'
import { camposFicha, cilindradas, limpiarWiki, rangosAnios, traccionDe } from './wikitexto'

// Fragmentos reales (resumidos) de las fichas de es.wikipedia y en.wikipedia del Peugeot 206
const ES = `{{Problemas artículo|referencias adicionales}}
{{Ficha de automóvil
| fabricante       = [[Peugeot]]
| período          = 1998-2012 (Francia)<br />1999-2016 (Argentina)<br />2001-2015 (Brasil)
| tipo             = [[Automóvil de turismo]] [[Segmento B|(B)]]
| carrocería       = [[Hatchback]] 3 y 5 puertas<br />[[Sedán]] 4 puertas
| configuración    = [[Disposición del motor#Posición_del_motor|Motor delantero]] [[Motor transversal|transversal]], [[tracción delantera]]
| peso           = {{convertir|960 a 1145|kg|lb|0|abr=1}}
| distancia entre ejes={{convertir|2442|mm|abr=3}}
| producción     = {{Unidad|8358217|unidades}}{{Cita requerida}}
| transmisión    = [[Transmisión manual|Manual]] de 5 velocidades<br />[[Transmisión automática|Automática]] de 4 velocidades
}}
El '''Peugeot 206''' es un automóvil.`

const EN = `{{Infobox automobile
| name = Peugeot 206
| engine = {{ubl
 | 1.1 L ''[[PSA TU engine|TU1]]'' [[Straight-four engine|I4]]
 | 1.4 L ''TU3'' I4
 | 1.6 L ''TU5'' I4
 | 2.0 L ''EW10'' I4
 | 1.4 L ''[[PSA DV engine|DV4]]'' [[diesel engine|diesel]] I4
}}
| layout = [[Front-engine, front-wheel-drive layout|Front-engine, front-wheel-drive]]
| weight = {{convert|950|-|1145|kg|abbr=on}}
}}`

describe('fichas de Wikipedia', () => {
  it('lee la ficha en español con enlaces, saltos de línea y plantillas', () => {
    const f = camposFicha(ES, ['Ficha de automóvil'])
    expect(f['fabricante']).toBe('Peugeot')
    expect(f['carrocería']).toBe('Hatchback 3 y 5 puertas; Sedán 4 puertas')
    expect(f['transmisión']).toBe('Manual de 5 velocidades; Automática de 4 velocidades')
    expect(f['configuración']).toBe('Motor delantero transversal, tracción delantera')
    expect(f['peso']).toBe('960 a 1145 kg')
    expect(f['distancia entre ejes']).toBe('2442 mm')
    expect(f['producción']).toBe('8358217 unidades')
  })
  it('lee la ficha en inglés con listas de varias líneas', () => {
    const f = camposFicha(EN, ['Infobox automobile'])
    expect(f['engine']).toBe('1.1 L TU1 I4; 1.4 L TU3 I4; 1.6 L TU5 I4; 2.0 L EW10 I4; 1.4 L DV4 diesel I4')
    expect(f['weight']).toBe('950–1145 kg')
    expect(cilindradas(f['engine'])).toEqual(['1.1', '1.4', '1.6', '2.0'])
    expect(traccionDe(f['layout'])).toBe('Delantera')
  })
  it('motores reales con &nbsp; (texto tal cual de en.wikipedia, Peugeot 206)', () => {
    const real = "{{Infobox automobile\n| engine = {{ubl\n  | '''[[Petrol engine|Petrol]]:'''\n  | 1.0&nbsp;L ''[[Renault D-Type engine#D4D|D4D]]'' I4 (Brazil)\n  | 1.6&nbsp;L ''[[PSA TU engine#TU5|TU5JP]]'' I4\n  | 2.0&nbsp;L ''[[PSA EW/DW engine#EW10|EW10J4]]/[[PSA EW/DW engine#EW10|J4S]]'' 16V I4\n  | '''[[Diesel engine|Diesel]]:'''\n  | 1.4&nbsp;L ''[[Ford DLD engine#DLD-414|DV4]]'' [[HDi]] I4\n}}\n}}"
    const f = camposFicha(real, ['Infobox automobile'])
    expect(cilindradas(f['engine'])).toEqual(['1.0', '1.4', '1.6', '2.0'])
    expect(f['engine']).toContain('Diesel:')
  })
  it('rangos de producción y tracción en español', () => {
    expect(rangosAnios('1998-2012 (Francia); 1999-2016 (Argentina)')).toEqual([[1998, 2012], [1999, 2016]])
    expect(rangosAnios('1988-presente')[0][0]).toBe(1988)
    expect(traccionDe('tracción trasera o tracción en las cuatro ruedas')).toBe('Trasera o 4x4')
  })
  it('limpia referencias y negritas', () => {
    expect(limpiarWiki("'''Motor''' 1.6<ref>{{cita web|url=x}}</ref> [[Gasolina|nafta]]")).toBe('Motor 1.6 nafta')
  })
  it('sin ficha devuelve vacío', () => {
    expect(camposFicha('texto sin ficha', ['Ficha de automóvil'])).toEqual({})
  })
})
