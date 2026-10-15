# Modelos 3D

Los modelos del atlas salen de **BodyParts3D 4.0** (The Database Center for Life Science, Japón), licencia **CC BY 4.0**
(<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>). Los `.glb` ya convertidos están en `public/atlas/`
y se publican con la app; los archivos originales **no** se suben (carpeta `fuente/`, en `.gitignore`).

## Volver a generar los `.glb`

1. Bajá a `modelos-3d/fuente/` estos archivos de <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>:
   - `partof_BP3D_4.0_obj_99.zip` (65 MB) e `isa_BP3D_4.0_obj_99.zip` (143 MB)
   - `partof_element_parts.txt` e `isa_element_parts.txt`
   (con `curl -L -O https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/<archivo>`)
2. Corré `node scripts/modelos/convertir.mjs` (o con el id de una escena: `node scripts/modelos/convertir.mjs rinones`).
3. El script lee `src/atlas/escenas.json`, arma cada estructura uniendo sus mallas, la pasa a las coordenadas
   de la escena, simplifica si hace falta (≤160 000 triángulos por escena), comprime con meshopt y escribe
   `public/atlas/<escena>.glb` y `src/atlas/creditos.json`.

Para sumar una estructura: agregá la pieza (con su código FMA) en `src/atlas/escenas.json`, su ficha en
`src/atlas/estructuras.json` y volvé a correr el script. Los códigos FMA están en `isa_parts_list_e.txt` /
`partof_parts_list_e.txt` (mismo sitio).
