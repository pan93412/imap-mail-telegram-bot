import { htmlToText } from "html-to-text";
import { decodeWords } from "postal-mime";

export function emailToText(emailTextContent: string): string {
    const decoded = decodeWords(emailTextContent);

    const plainTextContent = htmlToText(decoded);

    return plainTextContent;
}
