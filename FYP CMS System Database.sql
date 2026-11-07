-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: switchyard.proxy.rlwy.net    Database: railway
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `canvases`
--

DROP TABLE IF EXISTS `canvases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `canvases` (
  `canvas_id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `canvas_order` int NOT NULL DEFAULT '1',
  `duration_seconds` int NOT NULL DEFAULT '10',
  `width` int NOT NULL DEFAULT '1920',
  `height` int NOT NULL DEFAULT '1080',
  `background_color` varchar(20) DEFAULT '#FFFFFF',
  `background_image_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`canvas_id`),
  KEY `idx_canvases_project_id` (`project_id`),
  CONSTRAINT `fk_canvases_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `canvases`
--

LOCK TABLES `canvases` WRITE;
/*!40000 ALTER TABLE `canvases` DISABLE KEYS */;
INSERT INTO `canvases` VALUES (1,1,'Environmental Slide 1',1,10,1920,1080,'#FFFFFF',NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(2,2,'Governance Slide 1',1,10,1920,1080,'#FFFFFF',NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(3,3,'Social Slide 1',1,10,1920,1080,'#FFFFFF',NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(85,10,'Page 1',1,10,1920,1080,'#e1ffd6',NULL,'2026-07-05 01:36:51','2026-07-05 01:36:51'),(87,8,'Page 1',1,10,1920,1080,'#f2f8f4',NULL,'2026-07-05 02:37:24','2026-07-05 02:37:24'),(93,11,'Page 1',1,10,1920,1080,'#f2f8f4',NULL,'2026-07-05 10:07:18','2026-07-05 10:07:18'),(94,4,'Cover page',1,10,1920,1080,'#ffffff','/uploads/backgrounds/2/1782309419501-3bdb8614-0b67-411a-94de-0891dbf549ea.jpg','2026-07-06 07:00:02','2026-07-06 07:00:02'),(95,4,'Content',2,10,1920,1080,'#ffffff',NULL,'2026-07-06 07:00:03','2026-07-06 07:00:03'),(96,4,'Page 3',3,10,1920,1080,'#ffffff',NULL,'2026-07-06 07:00:03','2026-07-06 07:00:03'),(97,4,'Page 4',4,10,1920,1080,'#ffffff',NULL,'2026-07-06 07:00:03','2026-07-06 07:00:03'),(101,5,'Page 1 Copy',1,10,1920,1080,'#f2f8f4',NULL,'2026-07-07 12:04:45','2026-07-07 12:04:45'),(102,5,'Page 1 Copy Copy Copy',2,10,1920,1080,'#f2f8f4',NULL,'2026-07-07 12:04:45','2026-07-07 12:04:45'),(103,5,'Page 1 Copy Copy',3,10,1920,1080,'#f2f8f4',NULL,'2026-07-07 12:04:45','2026-07-07 12:04:45'),(104,5,'Page 1',4,10,1920,1080,'#f2f8f4',NULL,'2026-07-07 12:04:45','2026-07-07 12:04:45');
/*!40000 ALTER TABLE `canvases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `components`
--

DROP TABLE IF EXISTS `components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `components` (
  `component_id` int NOT NULL AUTO_INCREMENT,
  `canvas_id` int NOT NULL,
  `type` enum('text','image','video','shape','iframe') NOT NULL,
  `content_text` text,
  `file_path` varchar(500) DEFAULT NULL,
  `external_url` varchar(500) DEFAULT NULL,
  `position_x` int NOT NULL DEFAULT '0',
  `position_y` int NOT NULL DEFAULT '0',
  `width` int NOT NULL DEFAULT '300',
  `height` int NOT NULL DEFAULT '200',
  `rotation` decimal(6,2) NOT NULL DEFAULT '0.00',
  `layer_order` int NOT NULL DEFAULT '1',
  `style_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`component_id`),
  KEY `idx_components_canvas_id` (`canvas_id`),
  KEY `idx_components_type` (`type`),
  CONSTRAINT `fk_components_canvas` FOREIGN KEY (`canvas_id`) REFERENCES `canvases` (`canvas_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=437 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `components`
--

LOCK TABLES `components` WRITE;
/*!40000 ALTER TABLE `components` DISABLE KEYS */;
INSERT INTO `components` VALUES (1,1,'text','Environmental Project Title',NULL,NULL,100,100,700,120,0.00,1,'{\"color\": \"#000000\", \"fontSize\": 48, \"fontWeight\": \"bold\"}','2026-06-24 04:30:40','2026-06-24 04:30:40'),(2,2,'text','Governance Project Title',NULL,NULL,100,100,700,120,0.00,1,'{\"color\": \"#000000\", \"fontSize\": 48, \"fontWeight\": \"bold\"}','2026-06-24 04:30:40','2026-06-24 04:30:40'),(3,3,'text','Social Project Title',NULL,NULL,100,100,700,120,0.00,1,'{\"color\": \"#000000\", \"fontSize\": 48, \"fontWeight\": \"bold\"}','2026-06-24 04:30:40','2026-06-24 04:30:40'),(341,85,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 0.4, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-05 01:36:51','2026-07-05 01:36:51'),(342,85,'text','Supporting Social Causes',NULL,NULL,68,164,1023,204,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 32, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-05 01:36:51','2026-07-05 01:36:51'),(343,85,'text','You’ll also step into meaningful community work through initiatives like the annual Pesta Ubin Project. By supporting health and wellness programmes on Pulau Ubin, you’ll play an a',NULL,NULL,68,301,1121,154,0.00,2,'{\"color\": \"#53685f\", \"fontSize\": 22, \"textType\": \"subtitle\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-05 01:36:51','2026-07-05 01:36:51'),(349,87,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-05 02:37:24','2026-07-05 02:37:24'),(350,87,'text','Hello',NULL,NULL,70,532,1680,150,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-05 02:37:24','2026-07-05 02:37:24'),(351,87,'text','Hello testing',NULL,NULL,53,256,1180,110,0.00,1,'{\"color\": \"#53685f\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-05 02:37:24','2026-07-05 02:37:24'),(352,87,'image','Image 1','/uploads/images/2/1782464228849-0a4448bb-e52b-435d-a361-a3e78ac0d221.png',NULL,1223,179,610,404,0.00,2,'{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"imagePaths\": [\"/uploads/images/2/1782464228849-0a4448bb-e52b-435d-a361-a3e78ac0d221.png\"], \"widgetKind\": \"image\", \"aspectRatio\": 1.5114235500878734, \"displayMode\": \"individual\", \"imageSettings\": [{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"aspectRatio\": 1.5114235500878734, \"originalWidth\": 860, \"originalHeight\": 569, \"aspectRatioChoice\": \"original\"}], \"lockAspectRatio\": true, \"aspectRatioChoice\": \"original\"}','2026-07-05 02:37:24','2026-07-05 02:37:24'),(381,93,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-05 10:07:18','2026-07-05 10:07:18'),(382,93,'text','Hello testing',NULL,NULL,66,171,320,90,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 32, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-05 10:07:18','2026-07-05 10:07:18'),(383,93,'image','Upload a project photo',NULL,NULL,152,304,1050,500,0.00,1,'{\"objectFit\": \"cover\", \"widgetKind\": \"image\", \"aspectRatio\": 1.7777777777777777, \"displayMode\": \"individual\", \"lockAspectRatio\": true, \"aspectRatioChoice\": \"custom\"}','2026-07-05 10:07:18','2026-07-05 10:07:18'),(384,93,'text','Bello',NULL,NULL,49,234,260,150,0.00,2,'{\"color\": \"#000000\", \"padding\": 24, \"fontSize\": 18, \"textAlign\": \"left\", \"fontWeight\": 400, \"widgetKind\": \"textArea\", \"backgroundColor\": \"#ffffff\", \"backgroundOpacity\": 0}','2026-07-05 10:07:18','2026-07-05 10:07:18'),(385,93,'text','Hello',NULL,NULL,1119,204,760,310,0.00,3,'{\"color\": \"#000000\", \"padding\": 24, \"fontSize\": 18, \"textAlign\": \"left\", \"fontWeight\": 400, \"widgetKind\": \"textArea\", \"backgroundColor\": \"#ffffff\", \"backgroundOpacity\": 0.8}','2026-07-05 10:07:18','2026-07-05 10:07:18'),(386,94,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 0.3, \"backgroundFit\": \"cover\"}','2026-07-06 07:00:02','2026-07-06 07:00:02'),(387,94,'text','Title',NULL,NULL,54,118,900,140,0.00,2,'{\"color\": \"#000000\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-06 07:00:02','2026-07-06 07:00:02'),(388,94,'text','Subtitle',NULL,NULL,67,197,900,110,0.00,3,'{\"color\": \"#fd1c1c\", \"fontSize\": 48, \"textType\": \"subtitle\", \"textAlign\": \"left\", \"fontWeight\": 600, \"widgetKind\": \"text\"}','2026-07-06 07:00:02','2026-07-06 07:00:02'),(389,94,'text','Double-click to edit this text area.',NULL,NULL,52,281,741,150,0.00,4,'{\"color\": \"#000000\", \"padding\": 24, \"fontSize\": 36, \"textAlign\": \"left\", \"fontWeight\": 400, \"widgetKind\": \"textArea\", \"backgroundColor\": \"#ffffff\", \"backgroundOpacity\": 0.8}','2026-07-06 07:00:02','2026-07-06 07:00:02'),(390,94,'video','Video','/uploads/videos/2/1782309392846-37eb7a2d-5d9b-4a8e-a123-d3d87b5bcb85.mp4',NULL,828,156,659,371,0.00,6,'{\"loop\": true, \"muted\": true, \"autoPlay\": true, \"widgetKind\": \"video\", \"aspectRatio\": 1.7777777777777777, \"playsInline\": true, \"lockAspectRatio\": true}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(391,94,'image','Image 1','/uploads/images/2/1782546794699-d8c93226-6438-4b8d-ad63-56118f175de8.jpg',NULL,49,447,610,343,0.00,7,'{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"imagePaths\": [\"/uploads/images/2/1782546794699-d8c93226-6438-4b8d-ad63-56118f175de8.jpg\"], \"widgetKind\": \"image\", \"aspectRatio\": 1.7777777777777777, \"displayMode\": \"individual\", \"imageSettings\": [{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"aspectRatio\": 1.7777777777777777, \"originalWidth\": 1280, \"originalHeight\": 720, \"aspectRatioChoice\": \"original\"}], \"lockAspectRatio\": true, \"aspectRatioChoice\": \"original\"}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(392,95,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(393,95,'text','Nothing here',NULL,NULL,681,444,900,140,0.00,2,'{\"color\": \"#000000\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(394,96,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(395,97,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-06 07:00:03','2026-07-06 07:00:03'),(414,101,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(415,101,'text','Sustainability',NULL,NULL,120,100,1680,150,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(416,101,'text','protect the earth',NULL,NULL,120,270,1180,110,0.00,1,'{\"color\": \"#53685f\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(417,101,'shape','Key highlight',NULL,NULL,1230,440,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(418,101,'shape','Impact / result',NULL,NULL,1230,720,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(419,101,'image','Image 1','/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png',NULL,125,380,1030,580,0.00,2,'{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"imagePaths\": [\"/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png\"], \"widgetKind\": \"image\", \"aspectRatio\": 1.7777777777777777, \"displayMode\": \"individual\", \"imageSettings\": [{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"aspectRatio\": 1.7777777777777777, \"originalWidth\": 2559, \"originalHeight\": 1439, \"aspectRatioChoice\": \"16:9\"}], \"lockAspectRatio\": true, \"aspectRatioChoice\": \"16:9\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(420,102,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(421,102,'text','Sustainability',NULL,NULL,120,100,1680,150,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(422,102,'text','protect the earth',NULL,NULL,120,270,1180,110,0.00,1,'{\"color\": \"#53685f\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(423,102,'shape','Key highlight',NULL,NULL,1230,440,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(424,102,'shape','Impact / result',NULL,NULL,1230,720,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(425,102,'image','Image 1','/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png',NULL,125,380,1030,580,0.00,2,'{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"imagePaths\": [\"/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png\"], \"widgetKind\": \"image\", \"aspectRatio\": 1.7777777777777777, \"displayMode\": \"individual\", \"imageSettings\": [{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"aspectRatio\": 1.7777777777777777, \"originalWidth\": 2559, \"originalHeight\": 1439, \"aspectRatioChoice\": \"16:9\"}], \"lockAspectRatio\": true, \"aspectRatioChoice\": \"16:9\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(426,103,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(427,103,'text','Sustainability',NULL,NULL,120,100,1680,150,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(428,103,'text','protect the earth',NULL,NULL,120,270,1180,110,0.00,1,'{\"color\": \"#53685f\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(429,103,'shape','Key highlight',NULL,NULL,1230,440,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(430,103,'shape','Impact / result',NULL,NULL,1230,720,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(431,103,'image','Image 1','/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png',NULL,125,380,1030,580,0.00,2,'{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"imagePaths\": [\"/uploads/images/2/1782324790975-b087c745-c08b-45a9-a0e9-4fb8fcb48edb.png\"], \"widgetKind\": \"image\", \"aspectRatio\": 1.7777777777777777, \"displayMode\": \"individual\", \"imageSettings\": [{\"focusX\": 50, \"focusY\": 50, \"objectFit\": \"cover\", \"aspectRatio\": 1.7777777777777777, \"originalWidth\": 2559, \"originalHeight\": 1439, \"aspectRatioChoice\": \"16:9\"}], \"lockAspectRatio\": true, \"aspectRatioChoice\": \"16:9\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(432,104,'shape','__BACKGROUND_SETTINGS__',NULL,NULL,0,0,1920,1080,0.00,1,'{\"widgetKind\": \"backgroundSettings\", \"colorOpacity\": 1, \"imageOpacity\": 1, \"backgroundFit\": \"cover\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(433,104,'text','Sustainability',NULL,NULL,58,224,1680,150,0.00,1,'{\"color\": \"#16352a\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(434,104,'text','protect the earth',NULL,NULL,57,375,1180,110,0.00,1,'{\"color\": \"#53685f\", \"fontSize\": 72, \"textType\": \"title\", \"textAlign\": \"left\", \"fontWeight\": 700, \"widgetKind\": \"text\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(435,104,'shape','Key highlight',NULL,NULL,1221,360,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45'),(436,104,'shape','Impact / result',NULL,NULL,1230,598,570,220,0.00,1,'{\"color\": \"#315a49\", \"borderColor\": \"#acd3bc\", \"borderRadius\": 24, \"backgroundColor\": \"#eaf4ee\"}','2026-07-07 12:04:45','2026-07-07 12:04:45');
/*!40000 ALTER TABLE `components` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_base`
--

DROP TABLE IF EXISTS `knowledge_base`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base` (
  `article_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `category` enum('general','environmental','social','governance') NOT NULL DEFAULT 'general',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `file_type` enum('image','file') DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  PRIMARY KEY (`article_id`),
  KEY `idx_kb_user` (`user_id`),
  KEY `idx_kb_cat` (`category`),
  CONSTRAINT `fk_kb_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_base`
--

LOCK TABLES `knowledge_base` WRITE;
/*!40000 ALTER TABLE `knowledge_base` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_base` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monitor_commands`
--

DROP TABLE IF EXISTS `monitor_commands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monitor_commands` (
  `command_id` int NOT NULL AUTO_INCREMENT,
  `monitor_id` int NOT NULL,
  `requested_by` int NOT NULL,
  `command_type` enum('launch_display','restart_browser','reload_project','sleep_pc','wake_pc','shutdown_pc') NOT NULL,
  `request_id` varchar(100) NOT NULL,
  `status` enum('pending','sent','acknowledged','waiting_for_reconnect','completed','failed','timed_out') NOT NULL DEFAULT 'pending',
  `message` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `acknowledged_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`command_id`),
  UNIQUE KEY `request_id` (`request_id`),
  KEY `fk_monitor_commands_user` (`requested_by`),
  KEY `idx_command_monitor_created` (`monitor_id`,`created_at`),
  KEY `idx_command_status_created` (`status`,`created_at`),
  CONSTRAINT `fk_monitor_commands_monitor` FOREIGN KEY (`monitor_id`) REFERENCES `monitors` (`monitor_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monitor_commands_user` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monitor_commands`
--

LOCK TABLES `monitor_commands` WRITE;
/*!40000 ALTER TABLE `monitor_commands` DISABLE KEYS */;
INSERT INTO `monitor_commands` VALUES (21,10,1,'restart_browser','a9537c97-f95e-4fc7-8e5c-2227f4861758','completed','Kiosk Chrome restarted.','2026-07-06 15:14:02','2026-07-06 15:14:02','2026-07-06 15:14:05'),(22,10,1,'sleep_pc','84b32917-14df-462e-a00f-787a34dc237e','completed','Windows sleep request accepted.','2026-07-06 15:14:20','2026-07-06 15:14:20','2026-07-06 15:14:20'),(23,10,1,'sleep_pc','c8e879db-6d8f-4420-965b-2d68980c7eb4','completed','Windows sleep request accepted.','2026-07-06 15:17:59','2026-07-06 15:17:59','2026-07-06 15:17:59'),(24,10,1,'sleep_pc','4e3581d1-e1be-4351-956e-3eee056f2977','completed','Windows sleep request accepted.','2026-07-06 15:18:20','2026-07-06 15:18:20','2026-07-06 15:18:20'),(25,10,1,'sleep_pc','5ab43f82-d75a-4868-b7fb-147a63c5d262','completed','Windows sleep request accepted.','2026-07-06 15:26:09','2026-07-06 15:26:09','2026-07-06 15:26:09'),(26,10,1,'reload_project','09c74872-9090-4c79-beb2-8a5e59a8b181','completed','Display reloaded with the latest project.','2026-07-06 15:48:23','2026-07-06 15:48:23','2026-07-06 15:48:25'),(27,10,1,'launch_display','84a5b289-8dac-4f94-a78f-30909997f9c8','completed','Kiosk Chrome launched.','2026-07-06 15:48:33','2026-07-06 15:48:33','2026-07-06 15:48:33'),(28,10,1,'sleep_pc','3293d4a4-9324-4821-bab3-0d660cd78b10','completed','Windows sleep helper started. Watch Laptop B to confirm physical sleep.','2026-07-06 15:49:33','2026-07-06 15:49:33','2026-07-06 15:49:34'),(29,10,1,'wake_pc','4b924d42-f5ca-4b79-9ba1-8f329a682e9a','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 15:51:43',NULL,'2026-07-06 15:53:13'),(30,10,1,'wake_pc','458d79a9-178a-4473-ac02-b983aea1860c','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 15:53:06',NULL,'2026-07-06 15:54:36'),(31,10,1,'sleep_pc','d65580d2-3a1d-4ce0-9ad1-ac62cec9e3a1','completed','Windows sleep helper started. Watch Laptop B to confirm physical sleep.','2026-07-06 16:06:13','2026-07-06 16:06:13','2026-07-06 16:06:14'),(32,10,1,'wake_pc','7d5d1631-f0a6-400c-891f-dcc219f96e15','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 16:06:32',NULL,'2026-07-06 16:08:02'),(33,10,1,'wake_pc','abd2e8af-fd52-4ef1-a396-1a097078a9ec','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 16:07:38',NULL,'2026-07-06 16:09:08'),(34,10,1,'wake_pc','3d4dcd83-7d4b-4fd6-a9b5-3f7c9a63aa28','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 16:08:05',NULL,'2026-07-06 16:09:35'),(35,10,1,'reload_project','abb54181-2228-45e5-a2d3-18c9cc971bc2','completed','Display reloaded with the latest project.','2026-07-06 16:13:37','2026-07-06 16:13:37','2026-07-06 16:13:38'),(36,10,1,'sleep_pc','a6ee86e1-5f60-4abb-b39a-6ea68bdfb6bb','completed','Windows sleep helper started. Watch Laptop B to confirm physical sleep.','2026-07-06 16:14:51','2026-07-06 16:14:51','2026-07-06 16:14:51'),(37,10,1,'wake_pc','6439fd74-d1b0-43a1-a31d-9631fdb525b4','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 16:15:42',NULL,'2026-07-06 16:17:12'),(38,10,1,'sleep_pc','3faaa18f-0552-4baf-ac00-1b65e80ffd88','acknowledged','sleep-pc acknowledged by the display PC.','2026-07-06 16:22:44','2026-07-06 16:22:44','2026-07-06 16:22:44'),(39,10,1,'reload_project','4edf2b37-1d10-4fda-8b24-9acc5ff79986','completed','Display reloaded with the latest project.','2026-07-06 16:27:41','2026-07-06 16:27:41','2026-07-06 16:27:43'),(40,10,1,'sleep_pc','316cba4b-a208-44dd-ba53-32f7a8ce6d5a','completed','Windows sleep helper started. Watch Laptop B to confirm physical sleep.','2026-07-06 16:27:49','2026-07-06 16:27:49','2026-07-06 16:27:49'),(41,10,1,'wake_pc','3ca930f9-4690-409a-9c0c-428420c6ba1c','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-06 16:29:20',NULL,'2026-07-06 16:30:50'),(42,10,1,'reload_project','5dcd17d9-3829-4cd6-8176-23fb1f76f92a','completed','Display launched with the latest project.','2026-07-06 16:31:59','2026-07-06 16:31:59','2026-07-06 16:31:59'),(43,10,1,'reload_project','ec8e4407-2c3e-4058-8a6c-d8a75cd8eecc','completed','Display launched with the latest project.','2026-07-06 16:32:10','2026-07-06 16:32:10','2026-07-06 16:32:10'),(44,10,1,'reload_project','dc63f223-6759-4676-9a48-fd90cc3f4026','completed','Display launched with the latest project.','2026-07-06 16:32:19','2026-07-06 16:32:19','2026-07-06 16:32:19'),(45,19,1,'reload_project','3ced6af9-bcf8-4bb0-9034-62039001aaec','completed','Display reloaded with the latest project.','2026-07-08 03:23:15','2026-07-08 03:23:15','2026-07-08 03:23:23'),(46,19,1,'reload_project','82242471-8c1a-47a1-8e34-edabd3d25b72','completed','Display launched with the latest project.','2026-07-08 03:25:52','2026-07-08 03:25:52','2026-07-08 03:25:52'),(47,19,1,'reload_project','1ed904ed-8f01-49bc-bdd9-294d50e967a0','completed','Display reloaded with the latest project.','2026-07-08 03:51:41','2026-07-08 03:51:41','2026-07-08 03:51:42'),(48,19,1,'reload_project','53f293e4-19f1-4309-bd2e-09c25fbc7641','completed','Display reloaded with the latest project.','2026-07-08 03:53:17','2026-07-08 03:53:17','2026-07-08 03:53:23'),(49,19,1,'reload_project','ba218d5c-1439-45c5-bad8-15d9600a51f0','completed','Display reloaded with the latest project.','2026-07-08 04:01:23','2026-07-08 04:01:23','2026-07-08 04:01:24'),(50,19,1,'reload_project','28e47ba5-36b8-49dd-973c-79775d3ce91e','completed','Display reloaded with the latest project.','2026-07-08 04:03:27','2026-07-08 04:03:27','2026-07-08 04:03:32'),(51,19,1,'sleep_pc','634a8126-a427-4730-9894-de7bfa82cf8e','completed','Windows sleep helper started. Watch Laptop B to confirm physical sleep.','2026-07-08 04:10:15','2026-07-08 04:10:19','2026-07-08 04:10:19'),(52,19,1,'wake_pc','3b3b33a8-ac9c-4443-b02f-4a260b410ab5','timed_out','Wake-on-WLAN was not confirmed because no heartbeat resumed within 90 seconds.','2026-07-08 04:10:28',NULL,'2026-07-08 04:11:58');
/*!40000 ALTER TABLE `monitor_commands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monitor_playlist_items`
--

DROP TABLE IF EXISTS `monitor_playlist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monitor_playlist_items` (
  `playlist_item_id` int NOT NULL AUTO_INCREMENT,
  `monitor_id` int NOT NULL,
  `project_id` int NOT NULL,
  `display_order` int NOT NULL DEFAULT '1',
  `project_loop_count` int NOT NULL DEFAULT '1',
  `slide_duration_seconds` int NOT NULL DEFAULT '10',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`playlist_item_id`),
  UNIQUE KEY `unique_monitor_project` (`monitor_id`,`project_id`),
  UNIQUE KEY `unique_monitor_order` (`monitor_id`,`display_order`),
  UNIQUE KEY `unique_project_single_monitor` (`project_id`),
  KEY `idx_playlist_monitor_id` (`monitor_id`),
  KEY `idx_playlist_project_id` (`project_id`),
  KEY `idx_playlist_active` (`is_active`),
  KEY `idx_playlist_order` (`display_order`),
  KEY `idx_playlist_monitor_order` (`monitor_id`,`is_active`,`display_order`),
  KEY `idx_playlist_project` (`project_id`),
  CONSTRAINT `fk_playlist_monitor` FOREIGN KEY (`monitor_id`) REFERENCES `monitors` (`monitor_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_playlist_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monitor_playlist_items`
--

LOCK TABLES `monitor_playlist_items` WRITE;
/*!40000 ALTER TABLE `monitor_playlist_items` DISABLE KEYS */;
INSERT INTO `monitor_playlist_items` VALUES (61,10,4,1,1,10,1,'2026-07-08 02:54:58','2026-07-08 02:54:58'),(73,19,11,1,1,10,1,'2026-07-08 04:08:50','2026-07-08 04:08:50');
/*!40000 ALTER TABLE `monitor_playlist_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monitor_schedules`
--

DROP TABLE IF EXISTS `monitor_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monitor_schedules` (
  `schedule_id` int NOT NULL AUTO_INCREMENT,
  `monitor_id` int NOT NULL,
  `project_id` int NOT NULL,
  `created_by` int NOT NULL,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `status` enum('scheduled','active','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `notes` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`schedule_id`),
  KEY `fk_monitor_schedules_project` (`project_id`),
  KEY `fk_monitor_schedules_user` (`created_by`),
  KEY `idx_schedule_monitor_time` (`monitor_id`,`start_at`,`end_at`),
  KEY `idx_schedule_status_time` (`status`,`start_at`,`end_at`),
  CONSTRAINT `fk_monitor_schedules_monitor` FOREIGN KEY (`monitor_id`) REFERENCES `monitors` (`monitor_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monitor_schedules_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_monitor_schedules_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monitor_schedules`
--

LOCK TABLES `monitor_schedules` WRITE;
/*!40000 ALTER TABLE `monitor_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `monitor_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monitors`
--

DROP TABLE IF EXISTS `monitors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monitors` (
  `monitor_id` int NOT NULL AUTO_INCREMENT,
  `monitor_name` varchar(150) NOT NULL,
  `monitor_key` varchar(100) NOT NULL,
  `pairing_code` varchar(20) DEFAULT NULL,
  `monitor_category` enum('environmental','governance','social') NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `status` enum('online','offline','maintenance') NOT NULL DEFAULT 'offline',
  `last_connected_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pairing_expires_at` datetime DEFAULT NULL,
  `device_token_hash` varchar(64) DEFAULT NULL,
  `device_hostname` varchar(255) DEFAULT NULL,
  `last_ip_address` varchar(45) DEFAULT NULL,
  `mac_address` varchar(17) DEFAULT NULL,
  `agent_version` varchar(50) DEFAULT NULL,
  `browser_status` varchar(30) DEFAULT NULL,
  `last_heartbeat_at` datetime DEFAULT NULL,
  `is_paired` tinyint(1) NOT NULL DEFAULT '0',
  `paired_at` datetime DEFAULT NULL,
  `wake_on_wlan_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `last_wake_requested_at` datetime DEFAULT NULL,
  PRIMARY KEY (`monitor_id`),
  UNIQUE KEY `monitor_key` (`monitor_key`),
  UNIQUE KEY `uq_monitors_pairing_code` (`pairing_code`),
  KEY `idx_monitors_category` (`monitor_category`),
  KEY `idx_monitors_last_heartbeat` (`last_heartbeat_at`),
  KEY `idx_monitors_is_paired` (`is_paired`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monitors`
--

LOCK TABLES `monitors` WRITE;
/*!40000 ALTER TABLE `monitors` DISABLE KEYS */;
INSERT INTO `monitors` VALUES (6,'social_monitor_1','social_monitor_1','SOC006','social','Social Display Area','offline',NULL,'2026-06-24 04:30:40','2026-07-02 18:28:43','2026-07-03 18:28:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL),(7,'social_monitor_2','social_monitor_2','SOC007','social','Social Display Area','offline',NULL,'2026-06-24 04:30:40','2026-07-02 18:28:43','2026-07-03 18:28:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL),(10,'environmental_monitor_6','environmental_monitor_6','G9MWT68S','environmental','environmental Display Area','offline','2026-07-07 11:53:11','2026-06-26 07:23:37','2026-07-07 11:53:14','2026-07-07 15:08:46','ab4a5aac4f130564a01a6c172b8521038a0e1647d194f6cda2b03c3204a1d69a','DESKTOP-6GQR0VN','192.168.1.250','34:C9:3D:77:26:35','1.1.0','stopped','2026-07-06 16:32:24',1,'2026-07-06 15:12:57',0,'2026-07-06 16:29:20'),(19,'environmental_monitor_3','environmental_monitor_3','25NQE8RJ','environmental','environmental Display Area','offline','2026-07-08 04:10:19','2026-07-02 05:16:19','2026-07-08 04:10:28','2026-07-09 03:59:55','41e30ee7fe39ae8d3da65577a273d13c22a00f94f0d9292ae726a352f17f84a1','LAPTOP-IIA6MSTI','172.20.10.2','14:B5:CD:85:2F:A3','1.1.0','running','2026-07-08 04:10:19',1,'2026-07-08 04:00:49',0,'2026-07-08 04:10:28'),(20,'environmental_monitor_4','environmental_monitor_4','3UR5RJMK','environmental','environmental Display Area','offline',NULL,'2026-07-02 05:16:23','2026-07-08 03:34:28','2026-07-09 03:34:28',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL),(27,'social_monitor_3','social_monitor_3','6UU7D9','social','social Display Area','offline',NULL,'2026-07-05 10:03:22','2026-07-05 10:03:22','2026-07-06 10:03:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL),(31,'governance_monitor_2','governance_monitor_2','N6NE9A','governance','governance Display Area','offline',NULL,'2026-07-07 10:58:02','2026-07-07 10:58:02','2026-07-08 10:58:02',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,0,NULL);
/*!40000 ALTER TABLE `monitors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_collaborators`
--

DROP TABLE IF EXISTS `project_collaborators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_collaborators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('editor','viewer') NOT NULL DEFAULT 'editor',
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_user` (`project_id`,`user_id`),
  KEY `fk_pc_user` (`user_id`),
  CONSTRAINT `fk_pc_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_collaborators`
--

LOCK TABLES `project_collaborators` WRITE;
/*!40000 ALTER TABLE `project_collaborators` DISABLE KEYS */;
INSERT INTO `project_collaborators` VALUES (5,5,4,'viewer','2026-07-05 09:36:25'),(6,5,3,'editor','2026-07-05 09:36:30'),(7,11,4,'editor','2026-07-05 09:41:16');
/*!40000 ALTER TABLE `project_collaborators` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text,
  `category` enum('environmental','governance','social') NOT NULL,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `thumbnail_path` varchar(500) DEFAULT NULL,
  `is_template` tinyint(1) NOT NULL DEFAULT '0',
  `created_from_template_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`),
  KEY `fk_projects_template` (`created_from_template_id`),
  KEY `idx_projects_user_id` (`user_id`),
  KEY `idx_projects_category` (`category`),
  KEY `idx_projects_status` (`status`),
  KEY `idx_projects_is_template` (`is_template`),
  CONSTRAINT `fk_projects_template` FOREIGN KEY (`created_from_template_id`) REFERENCES `projects` (`project_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,1,'Environmental Template','Default template for environmental category','environmental','draft',NULL,1,NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(2,1,'Governance Template','Default template for governance category','governance','draft',NULL,1,NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(3,1,'Social Template','Default template for social category','social','draft',NULL,1,NULL,'2026-06-24 04:30:40','2026-06-24 04:30:40'),(4,2,'Testing','This is the first testing.','environmental','published',NULL,0,NULL,'2026-06-24 12:44:47','2026-07-06 15:47:47'),(5,2,'Sustainability','Sustainability','environmental','draft',NULL,0,NULL,'2026-06-24 16:18:27','2026-07-07 12:04:45'),(8,2,'Testing','Testing','social','published',NULL,0,NULL,'2026-06-25 14:08:54','2026-07-05 09:41:03'),(10,2,'Supporting Social Causes','You’ll also step into meaningful community work through initiatives like the annual Pesta Ubin Project. By supporting health and wellness programmes on Pulau Ubin, you’ll play an active role in promoting sustainability and improving lives, while learning how your efforts can create real change.','social','published',NULL,0,NULL,'2026-06-26 10:08:52','2026-07-05 02:37:04'),(11,2,'Testing 2','Test','environmental','published',NULL,0,NULL,'2026-07-02 19:17:53','2026-07-05 16:29:37');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','producer') NOT NULL DEFAULT 'producer',
  `reset_token_hash` varchar(255) DEFAULT NULL,
  `reset_token_expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `avatar_path` varchar(500) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '1',
  `email_verification_token_hash` varchar(255) DEFAULT NULL,
  `email_verification_expires_at` datetime DEFAULT NULL,
  `pending_email` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','24011094@myrp.edu.sg','$2b$10$NGg5yjLFtzLsc2PeaFnyIuZGwIP5ZsHGhzpdJT.zXphX5jMhrxpwC','admin',NULL,NULL,'2026-06-24 04:30:40','2026-07-07 11:51:25',NULL,1,NULL,NULL,NULL),(2,'producer','digitalsignagecms2026@gmail.com','$2b$10$gtQuzEfQH5VJbr8LonReMOZmuQu39gf34.MHqvVHgYZGlRbU270qe','producer',NULL,NULL,'2026-06-24 04:30:40','2026-07-07 11:49:45',NULL,1,NULL,NULL,NULL),(3,'producer1','producer@gmail.com','$2b$10$UgjsCE5cuJcZhKkT/bgQeu0AONJRFeFnGdfTK2CKRUH7yeZUGzDCC','producer',NULL,NULL,'2026-06-24 15:02:08','2026-06-24 15:02:08',NULL,1,NULL,NULL,NULL),(4,'hello','hello@gmail.com','$2b$10$Jg4mTwUmE7EfZEzK6EJX9uHnk3yBAitkkdaoaQp7u1Xy4LX9/ROr.','producer',NULL,NULL,'2026-07-04 17:31:39','2026-07-04 17:31:39',NULL,1,NULL,NULL,NULL),(5,'Jen','jen@gmail.com','$2b$10$yDH8yWhGb7lyBJnIDbE7pOqubnKOau7i.ihBAU0ye1ImeLvNeEmJO','producer',NULL,NULL,'2026-07-07 11:25:21','2026-07-07 11:26:53',NULL,0,'d629fb1712a83a8eff50c6777cf2c155b34609e028c98f05bca879163963505b','2026-07-08 19:26:53','24011094@myrp.edu.sg');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-08 12:29:30
