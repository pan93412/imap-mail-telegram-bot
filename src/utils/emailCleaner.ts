import { htmlToText } from "html-to-text";
import { decodeWords } from "postal-mime";
import quotedPrintable from "quoted-printable";

export function emailToText(emailTextContent: string): string {
    const contentWithoutTrailingNewline = decodeWords(emailTextContent);
    const decoded = quotedPrintable.decode(contentWithoutTrailingNewline);

    console.log(decoded);

    const plainTextContent = htmlToText(decoded);

    return plainTextContent;
}
