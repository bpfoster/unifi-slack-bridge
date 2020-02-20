FROM node as builder

WORKDIR /app

ENV SLACK_WEBHOOK=
ENV UNIFI_CONTROLLER=
ENV UNIFI_USERNAME=
ENV UNIFI_PASSWORD=

COPY package.json .
COPY package-lock.json .
RUN npm i

COPY . .

FROM node:alpine

WORKDIR /app
COPY --from=builder /app .

ENTRYPOINT ["node", "index.js"]
