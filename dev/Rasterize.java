import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.image.PNGTranscoder;

import java.io.*;

public class Rasterize {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("usage: Rasterize <source.svg> <output-dir> <size> [size...]");
            System.exit(2);
        }
        String src = args[0];
        File outDir = new File(args[1]);
        if (!outDir.isDirectory() && !outDir.mkdirs()) {
            System.err.println("cannot create output directory: " + outDir);
            System.exit(1);
        }
        for (int i = 2; i < args.length; i++) {
            int size = Integer.parseInt(args[i]);
            PNGTranscoder t = new PNGTranscoder();
            t.addTranscodingHint(PNGTranscoder.KEY_WIDTH, (float) size);
            t.addTranscodingHint(PNGTranscoder.KEY_HEIGHT, (float) size);
            File out = new File(outDir, baseName(src) + "_" + size + ".png");
            try (InputStream in = new FileInputStream(src);
                 OutputStream os = new FileOutputStream(out)) {
                t.transcode(new TranscoderInput(in), new TranscoderOutput(os));
            }
            System.out.println(out + " -> " + out.length() + " bytes");
        }
    }

    private static String baseName(String path) {
        String name = new File(path).getName();
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
