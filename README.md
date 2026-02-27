# HTMLRenderer

A lightweight, performant, and fully customizable HTML renderer for
**React Native**.

Built using `htmlparser2` for parsing and `expo-image` for optimized
image rendering,\
`HTMLRenderer` converts raw HTML strings into native React Native
components with:

- Headings (h1--h6)
- Paragraphs
- Lists (ordered & unordered, nested)
- Blockquotes
- Code blocks & inline code
- Images
- Dividers
- Auto-link detection
- RTL support
- Inline CSS support (limited but practical)
- Dark mode support
- Scroll conflict handling

---

## ✨ Features

- 📄 Parses HTML safely using `htmlparser2`
- 🔗 Secure link sanitization (http, https, mailto, tel only)
- 🖼 Optimized image rendering using `expo-image`
- 🎨 Custom font family support
- 🧩 Customizable heading styles
- 🌙 Dark mode aware
- 📜 ScrollView conflict-safe (via `scrollEnabled`)
- ⚡ Virtualized rendering using `FlatList` for performance
- 🧠 Auto-detects inline links (URLs & emails)
- 📝 Inline CSS parsing (color, margin, padding, font-size,
  text-align, etc.)

---

## 📦 Installation

```bash
npm install htmlparser2 expo-image
```

or

```bash
yarn add htmlparser2 expo-image
```

Make sure your project already includes:

- react
- react-native
- expo (if using expo-image)

---

## 🚀 Usage

```tsx
import HTMLRenderer from "./HTMLRenderer";

export default function Example() {
  return (
    <HTMLRenderer
      html={`
        <h1>Hello World</h1>
        <p>This is <strong>bold</strong> and <em>italic</em> text.</p>
        <a href="https://example.com">Visit Example</a>
      `}
    />
  );
}
```

---

## 🧩 Props

---

Prop Type Default Description

---

`html` `string` **required** Raw HTML string to render

`fontBaseName` `string` `"System"` Base font family name

`baseFontSize` `number` `16` Base font size for body
text

`tagStyles` `Partial<Record<h1-h6, InlineStyles>>` `undefined` Override heading styles

`containerStyle` `StyleProp<ViewStyle>` `undefined` Style applied to root
container

`onImagePress` `(src: string, ratio: number) => void` `undefined` Callback when image is
pressed

`onLinkPress` `(href: string) => void` `undefined` Custom link handler

`scrollEnabled` `boolean` `true` Disable when nested inside
ScrollView

---

---

## 📝 Supported HTML Tags

### Text & Structure

- p
- div
- section
- article
- header
- footer
- aside
- main
- h1 -- h6
- br
- hr

### Formatting

- strong / b
- em / i
- u
- s / strike / del
- sub
- sup
- code
- pre
- blockquote

### Lists

- ul
- ol
- li (nested supported)

### Media

- img

### Links

- a (http, https, mailto, tel only)

---

## 🎨 Inline CSS Support

Supported inline styles:

- color
- background-color
- font-size (px or number)
- text-align
- letter-spacing
- line-height
- font-weight
- font-style
- text-decoration
- margin (shorthand + individual)
- padding (shorthand + individual)
- text-indent

Example:

```html
<p style="color: red; font-size: 18px; margin: 10px;">Styled text</p>
```

---

## 🖼 Image Handling

Images are rendered using `expo-image` for better performance.

```tsx
<HTMLRenderer
  html='<img src="https://example.com/image.jpg" width="800" height="600" />'
  onImagePress={(src, ratio) => {
    console.log("Image clicked:", src);
  }}
/>
```

Aspect ratio is automatically calculated using width/height attributes
when available.

---

## 🔗 Link Handling

By default, links open using `Linking.openURL()`.

You can override:

```tsx
<HTMLRenderer
  html='<a href="https://example.com">Open</a>'
  onLinkPress={(url) => {
    console.log("Custom handling:", url);
  }}
/>
```

---

## 🌙 Dark Mode

Automatically adapts based on `useColorScheme()`.

Dark mode includes: - Text color adjustments - Background color
adjustments - Quote background styling - Link color adjustments

---

## 📜 Scroll Behavior

If used inside a parent `ScrollView`, disable internal scrolling:

```tsx
<HTMLRenderer html={htmlContent} scrollEnabled={false} />
```

---

## 🧠 Performance Notes

- Uses `FlatList` for virtualization
- Memoized text rendering
- Avoids unnecessary re-renders
- Efficient block-level parsing

---

## 🙌 Acknowledgements

This component relies on the following open-source libraries:

- htmlparser2 --- HTML parsing engine
- expo-image --- Optimized image rendering for React Native

Special thanks to:

- GitHub user **Tvinay03** for contributing to this project.

---

## 📄 License

MIT License

---

## ⭐ Contributing

Pull requests are welcome.\
Please open an issue first to discuss major changes.
