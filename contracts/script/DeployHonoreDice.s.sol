// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {HonoreDice} from "../src/HonoreDice.sol";

contract HonoreDiceScript is Script {
    HonoreDice public honoreDice;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        honoreDice = new HonoreDice();

        vm.stopBroadcast();
    }
}
