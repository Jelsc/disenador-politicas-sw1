package com.tuapp.backend.ai.reports;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class PdfGeneratorService {

    public byte[] generateAiReportPdf(String title, String body) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(document, out);

            document.open();

            // Tipografías
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18);
            Font dateFont = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 10);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 12);

            // Encabezado
            Paragraph header = new Paragraph("Sistema de Gestión de Trámites", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14));
            header.setAlignment(Element.ALIGN_CENTER);
            document.add(header);

            document.add(Chunk.NEWLINE);

            // Fecha
            String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
            Paragraph date = new Paragraph("Fecha de emisión: " + dateStr, dateFont);
            date.setAlignment(Element.ALIGN_RIGHT);
            document.add(date);

            document.add(Chunk.NEWLINE);

            // Título
            Paragraph pdfTitle = new Paragraph(title != null ? title : "Reporte Generado por IA", titleFont);
            pdfTitle.setAlignment(Element.ALIGN_LEFT);
            document.add(pdfTitle);

            document.add(Chunk.NEWLINE);

            // Cuerpo del reporte
            if (body != null) {
                // Separar por líneas para mantener el formato original (saltos de línea)
                String[] lines = body.split("\n");
                for (String line : lines) {
                    Paragraph p = new Paragraph(line, bodyFont);
                    p.setSpacingAfter(5f);
                    document.add(p);
                }
            } else {
                document.add(new Paragraph("No se proporcionó contenido para el reporte.", bodyFont));
            }

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error al generar el PDF del reporte", e);
        }
    }
}
