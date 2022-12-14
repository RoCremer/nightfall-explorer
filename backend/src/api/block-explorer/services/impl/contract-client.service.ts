import { Injectable, Logger } from '@nestjs/common';
import { IContractClientService } from '../icontract-client.service';
import { ConfigService } from '@nestjs/config';
import { HelperService, STATE_CONTRACT } from '../../../../utils';
import { ProposerDTO } from '../../../../models';
import {
  STATE_CONTRACT_ABI_FETCH_ERROR,
  STATE_CONTRACT_ADDRESS_FETCH_ERROR,
  STATE_CONTRACT_CURRENT_PROPOSER_ERROR,
} from '../../../../utils/exceptions';
import { IInitService } from '../iinit.service';
import Web3 from 'web3';
import { HttpService } from '@nestjs/axios';
import { CronJob } from 'cron';
import { CronExpression } from '@nestjs/schedule';

@Injectable()
export class ContractClientService implements IContractClientService, IInitService {
  private readonly logger = new Logger(STATE_CONTRACT);
  private stateContract;
  private stateContractName: string;
  private shieldContractName: string;

  // This property holds contract addresses for client
  private contractAddresses: Record<string, string>[] = [];

  constructor(private readonly config: ConfigService, private readonly http: HttpService) {
    this.stateContractName = this.config.get<string>('contract.stateContract');
    this.shieldContractName = this.config.get<string>('contract.shieldContract');
  }

  // This function is called on application startup
  async init() {
    this.logger.log(`[${STATE_CONTRACT}] service initialization`);

    // Fetch contract addresses and save them in memory
    await this.setContractAddresses();

    const contractAddress = await this.getContractAddress(this.stateContractName);
    const contractABI = await this.getContractAbi(this.stateContractName);

    // Make instance of contract
    this.stateContract = await this.initializeContract(contractABI, contractAddress);

    // Start cron job
    this.startCronJob();
  }

  /**
   * Calls current proposer from State contract
   * @returns
   */
  async getCurrentProposer(): Promise<ProposerDTO> {
    try {
      const currentProposer = await this.stateContract.methods.currentProposer().call();
      // isActive has default value true because it has to be active if it is current proposer
      const proposer: ProposerDTO = {
        address: currentProposer.thisAddress,
        url: currentProposer.url,
        isActive: true,
      };
      return proposer;
    } catch (err) {
      this.logger.error(err);
      return Promise.reject(STATE_CONTRACT_CURRENT_PROPOSER_ERROR);
    }
  }

  /**
   * This function returns contract instance and generates everything needed for that like provider, extracting contract address etc.
   * @returns
   */
  async initializeContract(contractABI: any, contractAddress: string) {
    const blockchainUrl = this.config.get('contract.blockchainUrl');
    const wsOptions = this.config.get('web3ProviderOptions');

    const provider = new Web3.providers.WebsocketProvider(blockchainUrl, wsOptions);

    /* istanbul ignore next */
    provider.on('error', () => this.logger.error(`Something went wrong with WebSocket provider`));
    /* istanbul ignore next */
    provider.on('connect', () => this.logger.log('WebSocket provider connected to blockchain'));
    /* istanbul ignore next */
    provider.on('end', () => this.logger.log('WebSocket provider disconnected from blockchain'));

    const web3Client = new Web3(provider);

    return new web3Client.eth.Contract(contractABI, contractAddress);
  }

  // Fetching contract address from optimist
  async getContractAddress(contractName: string, keepAliveFlag?: boolean): Promise<string> {
    const url = `${this.config.get('contract.optimistApiUrl')}/contract-address/${contractName}`;
    try {
      this.logger.log(`Fetching ${contractName} contract address from optimist`);

      const response = await this.http.axiosRef.get(url);
      return response.data.address;
    } catch (_) {
      this.logger.error(`${STATE_CONTRACT_ADDRESS_FETCH_ERROR} ${url}`);

      // If this function is called for setting contract addresses for client then don't exit application if optimist is not reachable
      // Only exit from app when calling this function for contract initialization
      if (!keepAliveFlag) {
        this.logger.error('Exiting application ...');
        process.exit(1);
      }
    }
  }

  // Fetching contract abi from optimist
  async getContractAbi(contractName: string): Promise<any> {
    const url = `${this.config.get('contract.optimistApiUrl')}/contract-abi/${contractName}`;
    try {
      this.logger.log(`Fetching ${contractName} contract abi from optimist`);

      const result = await this.http.axiosRef.get(url);
      return result.data.abi;
    } catch (error) {
      this.logger.error(`${STATE_CONTRACT_ABI_FETCH_ERROR} ${url}`);
      this.logger.error('Exiting application ...');
      process.exit(1);
    }
  }

  getContractAddresses(): Record<string, string>[] {
    return this.contractAddresses;
  }

  // Fetching contract addresses. This function will be called through cron job so optimist is not spammed with each client request
  async setContractAddresses(): Promise<void> {
    const promises: Promise<string>[] = Array.from([this.stateContractName, this.shieldContractName], (name) =>
      this.getContractAddress(name, true)
    );

    const [state, shield] = await Promise.allSettled(promises);
    const result: Record<string, string>[] = [];

    if (HelperService.isFullfiledPromise(state)) {
      result.push({
        [`${this.stateContractName.toLowerCase()}`]: `${HelperService.getPromiseValue<string>(state)}`,
      });
    }

    if (HelperService.isFullfiledPromise(shield)) {
      result.push({
        [`${this.shieldContractName.toLowerCase()}`]: `${HelperService.getPromiseValue<string>(shield)}`,
      });
    }

    this.contractAddresses = result;
  }

  startCronJob() {
    const job = new CronJob(CronExpression.EVERY_MINUTE, this.setContractAddresses.bind(this));
    job.start();
  }
}
