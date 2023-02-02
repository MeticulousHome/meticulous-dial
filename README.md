# Meticulous UI

## Start up

### Install Dependencies

```bash
npm install
```

### Run dev mode

```bash
npm run start
```

Note: you will need to have installed NodeJS v16.15.1 or major

## Code conventions

We are using [Commitizen](http://commitizen.github.io/cz-cli/) and [Commitlint](https://commitlint.js.org/#/) to provide commits meanfuls

## Formatter

We are using [Prettier](https://prettier.io/) to keep code in a standard way.

```bash
# Format the files exists
$ npm run format
```

## Make a commit

When you are ready to commit, run

```bash
$ npm run commit
```

We use the follow [structure](https://commitlint.js.org/#/concepts-commit-conventions)

```
type(scope): subject
```
---
## How Dial Works

### Gestures
Dial has only 3 actions that we can catch from it. `Turn Left`, `Turn Right` and `Click`.

<img src="./public/clockwise-gesture.png" width=300/>


### Behaviour
Based on the [gesture](#gestures), we need to use them into each state in a specific way. For instance, when the state is `showing barometer`, we have the three gestures available. On the other hand, when state is `showing scale`, we just have available the gesture **double click**.

> **Note:** _double click_ gesture comes from an extra hardware element.


<img src="./public/Dial-State.png" width=500/>