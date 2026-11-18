# 길이음

OpenStreetMap에서 실제 장소를 검색하고 두 지점 사이의 자동차 도로 거리를 확인하는 정적 웹앱입니다.

## 실행

`index.html`을 브라우저에서 열거나, 프로젝트 폴더를 정적 웹 호스팅에 배포하면 됩니다. 빌드 단계, Redis, 서버, API 키, 환경변수는 필요하지 않습니다.

## Vercel 배포

1. 이 폴더의 파일을 GitHub 저장소에 올립니다.
2. Vercel에서 **Add New → Project**를 선택한 뒤 저장소를 Import합니다.
3. 프레임워크는 **Other**로 두고 빌드 명령은 비워 둡니다. 출력 디렉터리는 프로젝트 루트(`.`)를 사용합니다.
4. 배포합니다. 환경변수는 설정하지 않아도 됩니다.

## 데이터 출처와 이용 안내

- 장소 검색은 Nominatim을 통해 OpenStreetMap 데이터를 조회합니다. 사용자가 검색 버튼을 눌렀을 때만 요청하며, 연속 검색은 최소 1초 간격으로 제한합니다.
- 자동차 도로 거리와 지도 링크는 공개 OSRM 서비스와 OpenStreetMap을 사용합니다. 공개 서비스의 이용 정책과 용량 제한이 적용되며, 서비스 가용성이나 경로 결과는 보장되지 않습니다.
- 거리 결과는 자동차 도로 경로 기준이며, 교통 상황이나 실시간 도로 통제는 반영하지 않습니다.
- 외부 데이터/API 이용 시에는 [OpenStreetMap 저작권 안내](https://www.openstreetmap.org/copyright), [Nominatim 사용 정책](https://operations.osmfoundation.org/policies/nominatim/), [OSRM 프로젝트 안내](https://project-osrm.org/)를 확인해 주세요.
