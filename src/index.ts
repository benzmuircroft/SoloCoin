import express from "express";
import bodyParser from "body-parser";
import _ from "lodash";

import {
  Block,
  generateNextBlock,
  generateNextBlockWithTransaction,
  generateRawNextBlock,
  getAccountBalance,
  getBlockchain,
  getMyUnspentTransactionOutputs,
  getUnspentTxOuts,
  sendTransaction
} from "./blockchain";
import { connectToPeers, getSockets, initP2PServer } from "./p2p";
import { getTransactionPool } from "./transactionPool";
import { getPublicFromWallet, initWallet } from "./wallet";

const httpPort = process.env.HTTP_PORT || 3001;
const p2pPort = process.env.P2P_PORT || 6001;

const initHttpServer = (httpPort: any) => {
  const app: express.Application = express();
  app.use(bodyParser.json());

  app.use((err: any, req: any, res: any) => {
    if (err) {
      res.status(400).send(err.message);
    }
  });

  app.get("/blocks", (req, res) => {
    res.send(getBlockchain());
  });

  app.get("/block/:hash", (req, res) => {
    const block = _.find(getBlockchain(), { hash: req.params.hash });
    res.send(block);
  });

  app.get("/transaction/:id", (req, res) => {
    const tx = _(getBlockchain())
      .map(blocks => blocks.data)
      .flatten()
      .find({ id: req.params.id });
    res.send(tx);
  });

  app.get("/address/:address", (req, res) => {
    const unspentTxOuts: any = _.filter(
      getUnspentTxOuts(),
      uTxO => uTxO.address === req.params.address
    );
    res.send({ unspentTxOuts: unspentTxOuts });
  });

  app.get("/unspentTransactionOutputs", (req, res) => {
    res.send(getUnspentTxOuts());
  });

  app.get("/myUnspentTransactionOutputs", (req, res) => {
    res.send(getMyUnspentTransactionOutputs());
  });

  app.post("/mineRawBlock", (req, res) => {
    if (req.body.data == null) {
      res.send("data parameter is missing");
      return;
    }
    const newBlock: any = generateRawNextBlock(req.body.data);
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.post("/mineBlock", (req, res) => {
    const newBlock: any = generateNextBlock();
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.get("/balance", (req, res) => {
    const balance: number = getAccountBalance();
    res.send({ balance: balance });
  });

  app.get("/address", (req, res) => {
    const address: string = getPublicFromWallet();
    res.send({ address: address });
  });

  app.post("/mineTransaction", (req, res) => {
    const address = req.body.address;
    const amount = req.body.amount;
    try {
      const resp = generateNextBlockWithTransaction(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.post("/sendTransaction", (req, res) => {
    try {
      const address = req.body.address;
      const amount = req.body.amount;

      if (address === undefined || amount === undefined) {
        throw Error("invalid address or amount");
      }
      const resp = sendTransaction(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.get("/transactionPool", (req, res) => {
    res.send(getTransactionPool());
  });

  app.get("/peers", (req, res) => {
    res.send(
      getSockets().map(
        (s: any) => s._socket.remoteAddress + ":" + s._socket.remotePort
      )
    );
  });
  app.post("/addPeer", (req, res) => {
    connectToPeers(req.body.peer);
    res.send();
  });

  app.post("/stop", (req, res) => {
    res.send({ msg: "stopping server" });
    process.exit();
  });

  app.listen(httpPort, () => {
    console.log("Listening http on port: " + httpPort);
  });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initWallet();
