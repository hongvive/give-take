# Give & Take (기부태익) 프로젝트 규칙

## 어셈블리 메타데이터 및 빌드 규칙 (Hongvive Studio)

모든 단일 포터블 바이너리(.exe) 빌드 시 다음 규칙을 항상 준수합니다:
1. **회사명 (Company)**: `Hongvive Studio` (고정)
2. **저작권 (Copyright)**: `Copyright © 2026 Hongvive Studio. All rights reserved.` (고정)
3. **상표 (Trademark)**: `Hongvive Studio™` (고정)
4. **정식 제품명 (Product)**: `기부태익 (期赴泰益) - Give & Take` (메인 프로그램명)
5. **파일 설명 (Description)**: `경조사에 때맞춰 찾아가(期赴) 큰 보탬을 나눈다(泰益) - 스마트 경조사 원장 데스크톱 앱` (메인 부제)
6. **버전 (Version)**: `1.0.0.0`
7. **보안 매니페스트 (`app.manifest`)**:
   - `asInvoker` 일반 권한 및 Windows 10/11 OS 호환성 명시 (윈도우 디펜더 오탐 방지)
8. **임베디드 리소스**:
   - 외부 파일 없이 단일 파일로 동작하도록 모든 웹 리소스(HTML/CSS/JS/ICO 등)를 바이너리 내부에 완전히 밀봉하여 컴파일.
