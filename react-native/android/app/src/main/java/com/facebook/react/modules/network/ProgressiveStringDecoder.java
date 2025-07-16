package com.facebook.react.modules.network;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

class ProgressiveStringDecoder {
    private static final String EMPTY_STRING = "";
    private final CharsetDecoder mDecoder;
    private byte[] remainder = null;

    public ProgressiveStringDecoder(Charset charset) {
        this.mDecoder = charset.newDecoder();
    }

    public String decodeNext(byte[] data, int length) {
        byte[] decodeData;
        if (this.remainder != null) {
            decodeData = new byte[this.remainder.length + length];
            System.arraycopy(this.remainder, 0, decodeData, 0, this.remainder.length);
            System.arraycopy(data, 0, decodeData, this.remainder.length, length);
            length += this.remainder.length;
        } else {
            decodeData = data;
        }

        ByteBuffer decodeBuffer = ByteBuffer.wrap(decodeData, 0, length);
        CharBuffer result = null;
        boolean decoded = false;
        int remainderLength = 0;

        while(!decoded && remainderLength < 4) {
            try {
                result = this.mDecoder.decode(decodeBuffer);
                decoded = true;
            } catch (CharacterCodingException var9) {
                ++remainderLength;
                decodeBuffer = ByteBuffer.wrap(decodeData, 0, length - remainderLength);
            }
        }

        boolean hasRemainder = decoded && remainderLength > 0;
        if (hasRemainder) {
            this.remainder = new byte[remainderLength];
            System.arraycopy(decodeData, length - remainderLength, this.remainder, 0, remainderLength);
        } else {
            this.remainder = null;
        }
        if (result != null) {
            return new String(result.array(), 0, result.length());
        } else {
            String extractedJson = extractPayloadFromEventStream(data, length);
            return extractedJson.isEmpty() ? "" : extractedJson;
        }
    }

    public static String extractPayloadFromEventStream(byte[] data, int dataLen) {
        List<String> payloads = new ArrayList<>();
        int pos = 0;
        while (pos + 12 <= dataLen && pos >= 0) {
            ByteBuffer buffer = ByteBuffer.wrap(data, pos, 8);
            buffer.order(ByteOrder.BIG_ENDIAN);

            int totalLength = buffer.getInt();
            int headersLength = buffer.getInt();

            if (pos + totalLength > dataLen) {
                break;
            }

            int payloadStart = pos + 12 + headersLength;
            int payloadEnd = pos + totalLength - 4;

            if (payloadStart > 0 && payloadStart < payloadEnd && payloadEnd <= dataLen) {
                byte[] payloadData = new byte[payloadEnd - payloadStart];
                System.arraycopy(data, payloadStart, payloadData, 0, payloadEnd - payloadStart);

                try {
                    String payloadStr = new String(payloadData, StandardCharsets.UTF_8);
                    payloads.add(payloadStr);
                } catch (Exception e) {
                    // ignore
                }
            }
            pos += totalLength;
        }
        return String.join("\n\n", payloads);
    }
}
