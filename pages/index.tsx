import { useEffect } from 'react';
import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Index.module.css'

const Home: NextPage = () => {
  useEffect(() => {
    let seed = Math.floor(Math.random() * 4294967295).toString(16);

    while (seed.length < 8) {
      seed = "0" + seed;
    }

    const jsimage = document.createElement("img");
    const wasmimage = document.createElement("img");

    const timeStart = new Date().getMilliseconds();

    let loadCount = 0;
    const onLoad = ((type) => {
        const timeEnd = new Date().getMilliseconds();
        console.log(`${type} loaded: ${timeEnd - timeStart}`);

        if (++loadCount != 2) {
            return;
        }

        jsimage.style.display = "inline-block";
        wasmimage.style.display = "inline-block";
    });

    jsimage.style.display = "none";
    jsimage.onload = (() => { onLoad("js"); });
    jsimage.src = `/api/maze-js?seed=${seed}`;

    wasmimage.style.display = "none";
    wasmimage.onload = (() => { onLoad("wasm"); });
    wasmimage.src = `/api/maze-c?seed=${seed}`;

    const mazeContainer = document.querySelector("#mazeContainer");

    let child;
    while (child = mazeContainer.firstChild) {
        mazeContainer.removeChild(child);
    }

    document.querySelector("#mazeContainer").appendChild(jsimage);
    document.querySelector("#mazeContainer").appendChild(wasmimage);

    document.querySelector("#mazeNumber").innerHTML = `0x${seed}`;
  });

  return (
    <div className={styles.container}>
      <Head>
        <title>Maze</title>
        <meta name="description" content="Maze generator and solver" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div id="mazeMetadata" className={styles.mazeMetadata}>
          Maze number: <span id="mazeNumber" className={styles.mazeNumber}>loading...</span>
        </div>

        <div id="mazeContainer" className={styles.mazeContainer}>
        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
    </div>
  )
}

export default Home
