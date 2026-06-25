# Evidence photo attributions

The evidence photos are real, openly-licensed images from Wikimedia Commons,
used here as stand-in citizen-report photos for the disclosed-synthetic demo
corpus. Each is read at build time by a real Gemini Vision call (see
`scripts/genVision.ts`); the committed `*.web.jpg` derivatives are downscaled and
EXIF-stripped.

| File | Subject | Author | License | Source |
|------|---------|--------|---------|--------|
| `R033-drain.*` | Curb gutter storm drain | Robert Lawton (Rklawton) | CC BY-SA 2.5 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Curb_gutter_storm_drain.JPG) |
| `R047-pothole.*` | Pothole, Newport (Isle of Wight) | Editor5807 | CC BY 3.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Newport_Whitepit_Lane_pot_hole.JPG) |
| `R064-crack.*` | Wall cracks, Millergasse 20, Vienna | Herzi Pinki (photo: Christian Philipp) | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Millergasse_20,_Vienna_-_cracks_01.jpg) |

`placeholder.svg` is original to this project (generic "photo attached" glyph for
reports whose photo is not analysed).
